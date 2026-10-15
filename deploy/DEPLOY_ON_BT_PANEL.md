# 宝塔面板部署操作指南（照着做即可）

> 每一步都是「复制粘贴」或「点按钮」。遇到报错**原样贴给我**，我来处理。

---

## 第 0 步：预检（2 分钟，很重要）

### 0.1 阿里云安全组必须放行 80 / 443
> 这一步不做，网站 100% 打不开，这是最常见的坑。

1. 打开 [阿里云控制台](https://ecs.console.aliyun.com) → **云服务器 ECS** → **实例**
2. 找到你的实例 → 点实例 ID 进去 → 左侧 **安全组** → **配置规则**
3. **入方向** → **手动添加**，加两条：

| 端口范围 | 授权对象 | 说明 |
|---|---|---|
| `80/80` | `0.0.0.0/0` | HTTP |
| `443/443` | `0.0.0.0/0` | HTTPS |

4. 保存

### 0.2 服务器配置预检
打开宝塔面板 → 左侧 **终端** → 粘贴执行：

```bash
free -h ; df -h /
```

**看两个数**：
- 内存（Mem 那行 total）**≥ 4GB** 才稳（构建和内核算模型都吃内存）
- 根目录剩余空间 **≥ 10GB**

任一不达标，先把结果贴给我。

---

## 第 1 步：上传并解压部署包

1. 宝塔面板 → 左侧 **文件** → 进入 `/www/wwwroot/`
2. 右上角 **上传** → 选中 `archiken-deploy.zip`（约 6.6MB）
3. 上传完成后，在文件列表里**右键**这个 zip → **解压到当前目录**

解压后应当是这两个目录：

```
/www/wwwroot/archiken/        ← 后端容器编排 + 源码
/www/wwwroot/archiken-web/    ← 前端网页文件
```

---

## 第 2 步：终端构建并启动容器

宝塔面板 → 左侧 **终端** → **逐行**复制粘贴执行（每行回车）：

```bash
cd /www/wwwroot/archiken
```

```bash
docker compose build
```

> 首次构建要拉镜像 + 装依赖，**大约 5~15 分钟**，中途看着不动是正常的，别中断。

```bash
docker compose up -d
```

```bash
sleep 20; docker compose ps
```

**预期**：两条记录，STATUS 都是 `Up ... (healthy)`。

```bash
curl -s http://127.0.0.1:4319/health; echo; curl -s http://127.0.0.1:4318/health; echo
```

**预期**：两行 JSON，都含 `"status":"ok"`，且 `"build"` 是一串类似 `1407608-20261015142426` 的构建号（**不是 `dev-local`**）。

> 如果提示 `docker: 'compose' is not a docker command`，说明是旧版 compose，把命令里的 `docker compose` 换成 `docker-compose` 再执行。

---

## 第 3 步：建站 + 反向代理 + 密码访问

### 3.1 添加站点
1. 左侧 **网站** → **添加站点**
   - **域名**：填你的域名（先用 IP 也行）
   - **PHP 版本**：选 **纯静态**
   - 其他默认 → 提交

### 3.2 配置反向代理
1. 站点列表里点你的站点名 → **设置** → 左侧 **配置文件**
2. 在 `server { }` 花括号**内部**，把**原来那段 `location /`** 整段删掉
3. 粘贴下面整段（`server_name` 保持宝塔自动生成的，不要动）：

```nginx
    client_max_body_size 512m;
    client_body_timeout 600s;
    send_timeout 300s;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location /api/kernel/ {
        proxy_pass http://127.0.0.1:4319/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location /api/server/ {
        proxy_pass http://127.0.0.1:4318/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location = /healthz {
        access_log off;
        proxy_pass http://127.0.0.1:4319/health;
    }

    root /www/wwwroot/archiken-web;
    try_files $uri $uri/ /index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
```

4. **保存**

### 3.3 开启密码访问（必做）
> 不开启的话，任何人都能往你服务器上传几百兆文件、跑满 CPU。**这一步等于给网站加一道登录**。

**方式 A（推荐，点按钮）**：站点 → **设置** → **访问限制** → 开启「**用户认证**」→ 添加一个用户名和密码 → 保存。
> 找不到这个入口就用方式 B。

**方式 B（终端一条命令）**：把 `zhangsan` / `MyPass123` 换成你想要的账号密码：

```bash
printf "zhangsan:$(openssl passwd -apr1 MyPass123)\n" > /www/wwwroot/archiken.htpasswd
```

然后在 3.2 的配置文件里，**在 `server { }` 内的最上面**加这两行，再保存：

```nginx
    auth_basic "ArchiKen";
    auth_basic_user_file /www/wwwroot/archiken.htpasswd;
```

保存后，浏览器访问网站会先弹出登录框，**输入你设置的账号密码**即可进入。

---

## 第 4 步：开启 HTTPS

1. 站点 → **设置** → 左侧 **SSL**
2. 选 **Let's Encrypt** → 勾选你的域名 → **申请**（证书 3 个月自动续签）
3. 申请成功后，打开右上角 **强制 HTTPS**

---

## 第 5 步：验证上线

浏览器打开（把域名换成你的）：

```
https://你的域名/healthz
```

应返回类似：

```json
{"status":"ok","service":"archiken-kernel","version":"0.12.0","build":"1407608-20261015142426"}
```

再打开 `https://你的域名/` → 应该看到 ArchiKen 的三维工作台界面 → 上传一个 IFC 模型试试。

**把上面这个 JSON 原样贴给我**，我这边会远程核对构建号与前端版本是否一致。

---

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 网站打不开、超时 | 阿里云**安全组**没放行 80/443（见第 0.1 步） |
| `docker compose build` 卡在 `npm ci` 很久 | 依赖源问题，**把终端输出贴给我**，我给换源方案 |
| 502 Bad Gateway | 后端容器没起好。终端执行 `docker compose ps` 和 `docker compose logs --tail=50`，结果贴给我 |
| 页面白屏 | 配置文件里 `root /www/wwwroot/archiken-web;` 路径写错了，对照 3.2 检查 |
| 上传模型报错 / 一直转圈 | 多半是内核容器没 healthy，或模型文件没落到 `/data/uploads`。贴日志给我 |
| 保存 Nginx 配置报错 | 说明括号不配对，把报错贴给我 |
| 浏览器一直弹登录框、密码不对 | 用方式 B 重新生成一次密码文件 |

> 万不得已要重来：终端执行 `cd /www/wwwroot/archiken && docker compose down`，删掉重装即可，**上传的模型和规则集存在数据卷里，不会丢**。
