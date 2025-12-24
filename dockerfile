# 使用官方轻量镜像
FROM directus/directus:11.1

# 切换到 root 权限进行文件拷贝和权限设置
USER root

# 1. 拷贝 package.json 和 package-lock.json (如果有)
# 这是为了安装你在 extension 中用到的第三方库
COPY package.json ./

# 2. 安装扩展所需的依赖
# 安装前删除 lock 文件并清理缓存
RUN rm -f package-lock.json && npm install --omit=dev

# 3. 拷贝所有的 extensions 文件夹
# 注意：Directus 启动时会自动扫描这个目录下的子文件夹
COPY ./extensions /directus/extensions

# 4. 修改权限，确保 node 用户可以读取
RUN chown -R node:node /directus/extensions /directus/node_modules

# 切换回安全用户
USER node