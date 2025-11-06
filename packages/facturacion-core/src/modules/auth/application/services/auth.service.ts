import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from '../dto/register.dto';
import { RegisterCompanyDto } from '../dto/register-company.dto';
import { LoginDto } from '../dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/shared/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24); // 24 horas

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

    // TODO: Aquí deberías enviar el email de verificación
    // await this.mailService.sendVerificationEmail(result.user.email, verificationToken);

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

  async registerUser(dto: RegisterDto) {
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
        companyId: dto.companyId,
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
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const { password, verificationToken, verificationTokenExpiry, ...userWithoutSensitiveData } = user;

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
      throw new UnauthorizedException('Token de verificación inválido');
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      throw new UnauthorizedException('El token de verificación ha expirado');
    }

    if (user.emailVerified) {
      return {
        message: 'El email ya ha sido verificado anteriormente',
        alreadyVerified: true,
      };
    }

    // Actualizar usuario
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

  private generateToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload);
  }
}