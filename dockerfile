FROM directus/directus:11.1

USER root

# 1. 禁用工作区逻辑
ENV NPM_CONFIG_WORKSPACES=false

# 2. 拷贝扩展和快照文件
COPY ./extensions /directus/extensions
COPY ./snapshot.json /directus/snapshot.json

# 3. 安装依赖（根据你之前的成功版本）
RUN npm install -g openai rss-parser

# 4. 权限修复
RUN chown -R node:node /directus

USER node

# 5. 修改启动命令：先应用快照，再启动服务
# --yes 参数会自动确认所有的表结构更改
CMD npx directus schema apply ./snapshot.json --yes && npx directus start