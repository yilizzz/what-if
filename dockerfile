FROM directus/directus:11.1

USER root

# 1. 彻底清空可能导致错误的 npm 缓存和配置
ENV NPM_CONFIG_USERCONFIG=/tmp/.npmrc

# 2. 先创建 extensions 目录
RUN mkdir -p /directus/extensions

# 3. 只拷贝 package.json 并原地安装
COPY package.json ./
# 使用 --no-bin-links 和 --no-package-lock 强制纯净安装
RUN npm install --omit=dev --no-package-lock --no-bin-links

# 4. 最后拷贝扩展代码
COPY ./extensions /directus/extensions

RUN chown -R node:node /directus/extensions

USER node