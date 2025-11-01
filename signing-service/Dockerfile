# Multi-stage build para optimizar el tamaño de la imagen

# Etapa 1: Build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Copiar archivos de configuración de Maven
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copiar código fuente y compilar
COPY src ./src
RUN mvn clean package -DskipTests

# Etapa 2: Runtime
FROM eclipse-temurin:17-jre
WORKDIR /app

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Crear usuario no privilegiado
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Copiar JAR desde la etapa de build
COPY --from=build /app/target/*.jar app.jar

# Crear directorio para logs
RUN mkdir -p /app/logs && chown -R appuser:appgroup /app

# Cambiar a usuario no privilegiado
USER appuser

# Exponer puerto
EXPOSE 8081


# Ejecutar aplicación
ENTRYPOINT ["bash", "-c", "java $JAVA_OPTS -jar app.jar"]
