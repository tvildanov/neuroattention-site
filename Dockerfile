# Build from the repository root: profile values remain in one canonical file.
FROM node:22.23.5-slim
WORKDIR /app
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/ ./
COPY data/profile-stats.json /data/profile-stats.json
RUN node -e "const c=require('/data/profile-stats.json');if(!Object.keys(c.profiles||{}).length)throw Error('Missing canonical profiles')"
EXPOSE 3001
CMD ["node", "server.js"]
