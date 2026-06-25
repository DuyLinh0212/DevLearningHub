# See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

# Giai đoạn 1: Chạy ứng dụng (Sử dụng Image Linux nhẹ của .NET 8)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

# Giai đoạn 2: Build source code (Sử dụng SDK Linux của .NET 8)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["DevLearningHub.Api.csproj", "."]
RUN dotnet restore "./DevLearningHub.Api.csproj"
COPY . .
WORKDIR "/src/."
# Đổi cú pháp biến môi trường từ kiểu Windows (%ENV%) sang kiểu Linux ($ENV)
RUN dotnet build "./DevLearningHub.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Giai đoạn 3: Publish ứng dụng
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./DevLearningHub.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Giai đoạn 4: Thành phẩm production [cite: 5]
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "DevLearningHub.Api.dll"]