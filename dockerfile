# 使用官方轻量镜像
FROM directus/directus:11.1

# 切换到 root 权限进行文件拷贝和权限设置
USER root

# 1. 拷贝 package.json 和 package-lock.json (如果有)
# 这是为了安装你在 extension 中用到的第三方库
COPY package.json ./

# 2. 安装扩展所需的依赖
# --production 减少镜像体积，适合 Railway 的 0.5GB 限制
RUN npm install --omit=dev --no-workspaces

# 3. 拷贝所有的 extensions 文件夹
# 注意：Directus 启动时会自动扫描这个目录下的子文件夹
COPY ./extensions ./extensions

# 4. 修改权限，确保 node 用户可以读取
RUN chown -R node:node /directus/extensions /directus/node_modules

# 切换回安全用户
USER node