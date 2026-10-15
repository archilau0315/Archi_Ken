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

1. 宝塔面板 → 左侧 **文件** → 进入 `/www/wwwroot/kbitai.com.cn/` → 右上角**新建文件夹**，名字填 `aitools`（已存在就跳过）→ 进入 `aitools/`
2. 右上角 **上传** → 选中 `archiken-deploy.zip`（约 6.8MB）
3. 上传完成后，在文件列表里**右键**这个 zip → **解压到当前目录**

解压后应当是这个结构（统一收在主站的 `aitools/` 目录里，便于管理）：

```
/www/wwwroot/kbitai.com.cn/aitools/archiken/      ← 后端容器编排 + 源码
/www/wwwroot/kbitai.com.cn/aitools/archiken-web/  ← 前端网页文件
```

---

## 第 2 步：终端构建并启动容器

宝塔面板 → 左侧 **终端** → **逐行**复制粘贴执行（每行回车）：

```bash
cd /www/wwwroot/kbitai.com.cn/aitools/archiken
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

## 第 3 步：在主站配置子路径

> ArchiKen 不单独建站，挂在主站 **kbitai.com.cn** 的 `/aitools/aichiken/` 子路径下。
> 所有改动都在主站配置里加几段，**不影响主站原有内容**。
> 当前为**开放访问**（无密码）；想加密码见文末「可选：开启密码访问」。

### 3.1 主站配置文件粘贴子路径块
1. 左侧 **网站** → 找到 **kbitai.com.cn** 主站 → 点 **设置** → 左侧 **配置文件**
2. 滚动到 `server { }` 花括号的**最后面**（也就是配置末尾的 `}` 之前）
3. 把下面整段**原样粘贴**进去：

```nginx
    # ===== ArchiKen 子路径开始 =====
    # 安全：后端源码和 .env 在网站目录下，禁止公网直接下载（应用本身不受影响）
    location ^~ /aitools/archiken/ {
        deny all;
    }

    location = /aitools/aichiken {
        return 301 /aitools/aichiken/;
    }

    location /aitools/aichiken/api/kernel/ {
        proxy_pass http://127.0.0.1:4319/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 512m;
    }

    location /aitools/aichiken/api/server/ {
        proxy_pass http://127.0.0.1:4318/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 512m;
    }

    location = /aitools/aichiken/healthz {
        access_log off;
        proxy_pass http://127.0.0.1:4319/health;
    }

    location /aitools/aichiken/ {
        alias /www/wwwroot/kbitai.com.cn/aitools/archiken-web/;
        try_files $uri $uri/ /aitools/aichiken/index.html;
    }
    # ===== ArchiKen 子路径结束 =====
```

4. **保存**。保存成功 = 配置语法没问题；如果报错，把报错**原样贴给我**。

> 说明：
> - 主站首页和其他页面**不受任何影响**。
> - 静态文件放在 `/www/wwwroot/kbitai.com.cn/aitools/archiken-web/`（第 1 步解压出来的），不占主站目录。

---

## 第 4 步：HTTPS（跳过）

主站 kbitai.com.cn 已有 SSL 证书，子路径自动跟着走 HTTPS，**这步什么都不用做**。

---

## 第 5 步：验证上线

浏览器打开：

```
https://www.kbitai.com.cn/aitools/aichiken/healthz
```

应返回类似：

```json
{"status":"ok","service":"archiken-kernel","version":"0.12.0","build":"1407608-20261015142426"}
```

再打开 `https://www.kbitai.com.cn/aitools/aichiken/` → 应该直接看到 ArchiKen 的三维工作台界面 → 上传一个 IFC 模型试试。

**把上面这个 JSON 原样贴给我**，我这边会远程核对构建号与前端版本是否一致。

---

## 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 网站打不开、超时 | 阿里云**安全组**没放行 80/443（见第 0.1 步） |
| `docker compose build` 卡在 `npm ci` 很久 | 依赖源问题，**把终端输出贴给我**，我给换源方案 |
| 502 Bad Gateway | 后端容器没起好。终端执行 `docker compose ps` 和 `docker compose logs --tail=50`，结果贴给我 |
| 页面白屏 | 配置文件里 `alias /www/wwwroot/kbitai.com.cn/aitools/archiken-web/;` 路径写错了，或子路径块贴错了位置，对照 3.1 检查 |
| API 全报 404 | 前端包不是子路径版（构建号太旧），用最新 zip 重新解压覆盖 |
| 上传模型报错 / 一直转圈 | 多半是内核容器没 healthy，或模型文件没落到 `/data/uploads`。贴日志给我 |
| 保存 Nginx 配置报错 | 说明括号不配对，把报错贴给我 |

> 万不得已要重来：终端执行 `cd /www/wwwroot/kbitai.com.cn/aitools/archiken && docker compose down`，删掉重装即可，**上传的模型和规则集存在数据卷里，不会丢**。

---

## 可选：开启密码访问

> 现在暂不启用。哪天想限制访问了，按下面两步即可，全程 2 分钟。

**① 生成密码文件**：宝塔终端执行（把账号密码换成你自己的）：

```bash
printf "zhangsan:$(openssl passwd -apr1 MyPass123)\n" > /www/wwwroot/kbitai.com.cn/aitools/archiken.htpasswd
```

**② 改配置**：主站「配置文件」里，在 ArchiKen 子路径块的**三个 location 内**（`api/kernel/`、`api/server/`、静态 `location /aitools/aichiken/`）各加这两行，保存：

```nginx
        auth_basic "ArchiKen";
        auth_basic_user_file /www/wwwroot/kbitai.com.cn/aitools/archiken.htpasswd;
```

保存后访问 `https://www.kbitai.com.cn/aitools/aichiken/` 会先弹登录框。想取消密码，把这两行删掉再保存即可。
