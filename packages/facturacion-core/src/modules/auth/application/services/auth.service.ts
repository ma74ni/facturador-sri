import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dto/register.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/password-reset.dto';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmailService } from '@/shared/email/email.service';

const PASSWORD_RESET_TTL_MINUTES = 60;
// Evita que alguien llene de correos la bandeja de otra persona.
const PASSWORD_RESET_COOLDOWN_SECONDS = 60;

// Misma respuesta exista o no la cuenta, para no revelar qué emails están registrados.
const FORGOT_PASSWORD_MESSAGE =
  'Si el email está registrado, te enviamos un enlace para restablecer tu contraseña.';

const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterCompanyDto) {
    // Verificar si el RUC ya existe
    const existingCompany = await this.prisma.company.findUnique({
      where: { ruc: dto.ruc },
    });

    if (existingCompany) {
      throw new ConflictException('El RUC ya está registrado');
    }

    // Verificar si el email del usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.userEmail },
    });

    if (existingUser) {
      throw new ConflictException('El email del usuario ya está registrado');
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Generar token de verificación de email
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setMinutes(verificationTokenExpiry.getMinutes() + 5); // 5 minutos

    // Crear empresa y usuario en una transacción
    const result = await this.prisma.$transaction(async (prisma) => {
      // Crear empresa
      const company = await prisma.company.create({
        data: {
          ruc: dto.ruc,
          businessName: dto.businessName,
          tradeName: dto.tradeName,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          environment: 'TEST',
          status: 'PENDING',
        },
      });

      // Crear usuario administrador
      const user = await prisma.user.create({
        data: {
          email: dto.userEmail,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'ADMIN',
          companyId: company.id,
          verificationToken,
          verificationTokenExpiry,
          emailVerified: false,
          lastVerificationEmailSent: new Date(),
        },
      });

      // Crear establecimiento y punto de emisión por defecto
      const establishment = await prisma.establishment.create({
        data: {
          code: '001',
          name: 'Matriz',
          address: dto.address,
          phone: dto.phone,
          companyId: company.id,
        },
      });

      await prisma.emissionPoint.create({
        data: {
          code: '001',
          description: 'Punto de emisión principal',
          establishmentId: establishment.id,
        },
      });

      return { company, user };
    });

    // Enviar email de verificación
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}`;

    try {
      await this.emailService.sendEmail({
        to: result.user.email,
        subject: 'Verifica tu email - Sistema de Facturación SRI',
        template: 'email-verification',
        context: {
          userName: `${result.user.firstName} ${result.user.lastName}`,
          verificationLink,
          year: new Date().getFullYear(),
        },
      });

      console.log('✅ Email de verificación enviado a:', result.user.email);
    } catch (error) {
      console.error('❌ Error al enviar email de verificación:', error);
      // No lanzar error, el usuario fue creado exitosamente
    }

    // En desarrollo, mostrar el link en consola
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Link de verificación:', verificationLink);
    }

    // Generar token JWT
    const token = this.generateToken(result.user.id);

    return {
      message: 'Empresa registrada exitosamente. Por favor verifica tu email.',
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        companyId: result.user.companyId,
        emailVerified: result.user.emailVerified,
      },
      company: {
        id: result.company.id,
        ruc: result.company.ruc,
        businessName: result.company.businessName,
        tradeName: result.company.tradeName,
        email: result.company.email,
        environment: result.company.environment,
        status: result.company.status,
        phone: result.company.phone,
        address: result.company.address,
      },
      access_token: token,
    };
  }

  /** Crea un usuario en la empresa del administrador que lo pide. */
  async registerUser(dto: RegisterDto, adminUserId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
      select: { companyId: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Crear usuario
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        companyId: admin.companyId,
      },
    });

    // Generar token
    const token = this.generateToken(user.id);

    return {
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      access_token: token,
    };
  }

  async login(dto: LoginDto) {
    // Buscar usuario
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar token
    const token = this.generateToken(user.id);

    return {
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      access_token: token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            ruc: true,
            businessName: true,
            tradeName: true,
            email: true,
            environment: true,
            status: true,
            phone: true,
            address: true,
            enabledModules: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const {
      password,
      verificationToken,
      verificationTokenExpiry,
      passwordResetTokenHash,
      passwordResetExpiry,
      ...userWithoutSensitiveData
    } = user;

    return {
      user: userWithoutSensitiveData,
      company: user.company,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      // Token no encontrado - puede ser inválido, expirado o ya utilizado
      throw new UnauthorizedException('Token de verificación inválido o ya utilizado. Si ya verificaste tu email, puedes iniciar sesión normalmente.');
    }

    // Verificar si el token está expirado
    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new UnauthorizedException('El token de verificación ha expirado');
    }

    // Verificar si el email ya fue verificado (caso raro donde el token existe pero ya está verificado)
    if (user.emailVerified) {
      return {
        message: 'El email ya ha sido verificado anteriormente',
        alreadyVerified: true,
      };
    }

    // Actualizar usuario - marcar como verificado y limpiar token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return {
      message: 'Email verificado exitosamente',
      alreadyVerified: false,
    };
  }

  /**
   * Reenviar email de verificación
   */
  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      return {
        message: 'El email ya ha sido verificado',
        alreadyVerified: true,
      };
    }

    // Validar cooldown de 5 minutos
    if (user.lastVerificationEmailSent) {
      const now = new Date();
      const lastSent = new Date(user.lastVerificationEmailSent);
      const diffInSeconds = Math.floor((now.getTime() - lastSent.getTime()) / 1000);
      const cooldownSeconds = 300; // 5 minutos

      if (diffInSeconds < cooldownSeconds) {
        const remainingSeconds = cooldownSeconds - diffInSeconds;
        throw new UnauthorizedException(
          `Debes esperar ${Math.ceil(remainingSeconds / 60)} minutos antes de solicitar otro email de verificación`,
        );
      }
    }

    // Generar nuevo token de verificación
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setMinutes(verificationTokenExpiry.getMinutes() + 5); // 5 minutos

    // Actualizar token y timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpiry,
        lastVerificationEmailSent: new Date(),
      },
    });

    // Construir link de verificación
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/verify-email?token=${verificationToken}`;

    // Enviar email de verificación
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Verifica tu email - Sistema de Facturación SRI',
        template: 'email-verification',
        context: {
          userName: `${user.firstName} ${user.lastName}`,
          verificationLink,
          year: new Date().getFullYear(),
        },
      });

      console.log('✅ Email de verificación enviado a:', user.email);
    } catch (error) {
      console.error('❌ Error al enviar email de verificación:', error);
      // No lanzar error, solo loguear. El token ya fue guardado.
    }

    // En desarrollo, mostrar el link en consola
    if (process.env.NODE_ENV === 'development') {
      console.log('🔗 Link de verificación:', verificationLink);
    }

    return {
      message: 'Email de verificación enviado exitosamente',
      // En desarrollo, retornamos el link. En producción, solo el mensaje
      ...(process.env.NODE_ENV === 'development' && { verificationLink }),
    };
  }

  /**
   * Envía un enlace para restablecer la contraseña. Responde lo mismo exista o
   * no la cuenta, y no reenvía si se pidió hace menos de un minuto.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const response = { message: FORGOT_PASSWORD_MESSAGE };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim() },
    });

    if (!user || !user.isActive) {
      return response;
    }

    if (user.lastPasswordResetSent) {
      const elapsedSeconds = (Date.now() - user.lastPasswordResetSent.getTime()) / 1000;
      if (elapsedSeconds < PASSWORD_RESET_COOLDOWN_SECONDS) {
        return response;
      }
    }

    const token = randomBytes(32).toString('hex');
    const passwordResetExpiry = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashResetToken(token),
        passwordResetExpiry,
        lastPasswordResetSent: new Date(),
      },
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/reset-password?token=${token}`;

    const result = await this.emailService.sendEmail({
      to: user.email,
      subject: 'Restablece tu contraseña - Sistema de Facturación SRI',
      template: 'password-reset',
      context: {
        userName: `${user.firstName} ${user.lastName}`,
        resetLink,
        expiryMinutes: PASSWORD_RESET_TTL_MINUTES,
        year: new Date().getFullYear(),
      },
    });

    if (!result.success) {
      this.logger.error(`No se pudo enviar el correo de recuperación a ${user.email}: ${result.error}`);
    }

    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`🔗 Link de recuperación: ${resetLink}`);
    }

    return response;
  }

  /**
   * Cambia la contraseña con un token vigente. El token sirve una sola vez y
   * las sesiones abiertas antes del cambio quedan cerradas.
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetTokenHash: hashResetToken(dto.token) },
    });

    // BadRequest y no Unauthorized: la web cierra la sesión ante un 401.
    if (!user || !user.isActive) {
      throw new BadRequestException(
        'El enlace no es válido o ya fue usado. Solicita uno nuevo.',
      );
    }

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('El enlace expiró. Solicita uno nuevo.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiry: null,
        passwordChangedAt: new Date(),
        // Abrir el enlace prueba que el correo es suyo.
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return { message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.' };
  }

  private generateToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload);
  }
}