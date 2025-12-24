FROM directus/directus:11.1

USER root

# 1. 禁用所有 npm 钩子和工作区逻辑
ENV NPM_CONFIG_WORKSPACES=false
ENV NPM_CONFIG_INCLUDE_WORKSPACE_ROOT=false

# 2. 直接拷贝 extensions
COPY ./extensions /directus/extensions

# 3. 如果你确实需要 openai 和 rss-parser，在启动前强行全局安装
# 这样可以避开 package.json 的递归扫描报错
RUN npm install -g openai rss-parser

# 4. 修复权限
RUN chown -R node:node /directus/extensions

USER node