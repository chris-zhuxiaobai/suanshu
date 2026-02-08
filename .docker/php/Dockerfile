FROM php:8.4-fpm

# --- 关键步骤：更换 Debian 软件源为阿里云 ---
# PHP 8.4 镜像通常基于 Debian 12 (bookworm)
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's/login.docker.com/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# 现在再执行安装，速度会快很多，也不会报错
RUN apt-get update && apt-get install -y \
    libpng-dev libjpeg-dev libfreetype6-dev zip unzip git curl libonig-dev libxml2-dev

# 清理缓存
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# 安装 PHP 核心扩展
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# 安装 Redis 扩展
RUN pecl install redis && docker-php-ext-enable redis

# 集成 Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html/backend