# ArchiKen 更新操作 SOP（Standard Operating Procedure）

> 任何版本更新都必须严格按此流程执行，**不得跳过任何步骤**。
> 目标：每次更新都安全、可回滚、两端一致。

---

## 角色与权限

| 角色 | 操作 |
|---|---|
| 主操作人 | 具备服务器 SSH 权限 + git push 权限 |
| 审核人 | 更新前 Review 变更清单 |

## 前置条件

- [ ] 代码已全部合入 `main` 分支
- [ ] 本地冒烟测试通过（dev + server + kernel 三进程）
- [ ] `deploy/.env` 已填写正确的 API Key 和服务器地址
- [ ] 服务器磁盘剩余 ≥ 5GB（Docker 镜像 + 临时构建产物）

---

## 阶段一：更新前备份（必做）

### 1.1 服务器数据备份

```bash
# SSH 到服务器
ssh root@your-server

# Docker 持久化卷备份（模型文件 + 规则集 + BCF + 报告）
docker run --rm -v archiken-data:/data -v $(pwd):/backup alpine tar czf /backup/archiken-data-backup-$(date +%Y%m%d).tar.gz -C /data .

# 备份 .env（API Key 不能丢）
cp /www/wwwroot/archiken/.env /www/wwwroot/archiken/.env.backup-$(date +%Y%m%d)
```

### 1.2 本地 git 状态确认

```powershell
cd e:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Achi_Ken
git status
git log --oneline -5
# 所有改动必须已 commit + push，不能有未提交的工作
```

### 1.3 打 git tag

```powershell
# 版本号按《版本同步规范》规则确定
git tag -a v0.13.0 -m "release: M12 新模块 / 性能优化"
git push origin v0.13.0
```

---

## 阶段二：同步发布（按 L2 → L3 → L4 顺序）

### 2.1 执行 deploy.ps1（全自动）

```powershell
cd e:\works\Aidev\Kbitai绝对安全\kbitai_com_cn\aitools\Achi_Ken\deploy
.\deploy.ps1
```

脚本会自动执行：
1. 前端 cloud 模式构建 → 得到 `dist/`
2. 生成版本标识（git hash + 时间戳）
3. 打包上传到服务器
4. 远程 `docker compose build`（无缓存）
5. 远程 `docker compose up -d`
6. 三端健康检查
7. **版本证据输出**（build_id / frontend_hash / git_commit 三者必须一致）

### 2.2 手动分步（如果脚本失败）

```bash
# 远程执行
cd /www/wwwroot/archiken

# 1. 拉最新代码（或重新上传）
git pull  # 或 rsync 上传

# 2. 重建
docker compose build --no-cache kernel server

# 3. 先停后端，再停 Nginx（避免中间态）
docker compose stop nginx
docker compose up -d kernel server
sleep 20  # 等内核 warm-up

# 4. 健康检查
curl -s http://127.0.0.1:4319/health
curl -s http://127.0.0.1:4318/health

# 5. 再启动 Nginx
docker compose up -d nginx

# 6. 整体状态
docker compose ps
```

### 2.3 版本回滚（如果新版本有问题）

```bash
cd /www/wwwroot/archiken

# 1. 停掉所有容器
docker compose down

# 2. 恢复 .env
cp .env.backup-YYYYMMDD .env

# 3. 恢复数据卷
docker run --rm -v archiken-data:/data -v $(pwd):/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/archiken-data-backup-YYYYMMDD.tar.gz -C /data"

# 4. 回到上一个 tag 的代码
git checkout v0.12.0
# 重新上传 dist/

# 5. 启动
docker compose up -d
```

---

## 阶段三：双端功能验证（必做）

### 3.1 云端 Web 端验证

| 序号 | 验证项 | 方法 | 通过标准 |
|---|---|---|---|
| 1 | 健康检查 | 浏览器访问 `https://域名/healthz` | 返回 `{"status":"ok",...}` |
| 2 | API Key 鉴权 | 不带 Key 访问 `/api/server/health` 以外路径 | 返回 401 |
| 3 | IFC 上传 | 上传测试模型文件 | 返回 `{"path":"...","name":"...","size":...}` |
| 4 | 模型摘要 | 调用 `/api/kernel/ifc/summary?path=...` | 返回 schema/counts_by_type |
| 5 | 3D 渲染 | 3D 视图加载模型 | 构件显示、拾取正常 |
| 6 | 碰撞检测 | 执行冲突矩阵 | 返回硬碰撞/间隙/净空分类 |
| 7 | 规则校验 | 运行合规预设 | 返回 violations 报告 |
| 8 | 报告导出 | 导出 PDF | 文件下载、中文正常 |

### 3.2 桌面端验证

| 序号 | 验证项 | 方法 | 通过标准 |
|---|---|---|---|
| 1 | Electron 启动 | 双击 exe | 正常打开主窗口 |
| 2 | 内核自动拉起 | 启动后检查任务管理器 | 有 python 和 node 进程 |
| 3 | 本地文件加载 | 打开 IFC 模型 | 与云端同一模型结果一致 |
| 4 | 功能冒烟 | 碰撞 / 规则 / 报告 各跑一次 | 结果与云端完全一致 |

### 3.3 版本一致性锚点

**必须**在两端各自的健康检查页面确认以下字段完全相同：

```
L2 kernel  /health        → version: "0.13.0", build: "a1b2c3d-20261015143000"
L3 server  /health        → version: "0.6.0",  build: "a1b2c3d-20261015143000"
L4 前端    dist/index.html  → index-8f3e2a1.js（产物 hash 与 deploy.ps1 输出一致）
```

---

## 阶段四：更新后收尾

| 步骤 | 内容 |
|---|---|
| 1 | 更新 `readme.md` 的版本号和变更日志 |
| 2 | 追加 `debug_log_x.md` 记录（时间 / 模块 / 变更简述 / 备注） |
| 3 | 本地 git commit + push（更新后的文档和 .env） |
| 4 | 通知用户群：新版本已上线，更新了什么 |
| 5 | 观察 24 小时：云端错误日志 + 内存/CPU 曲线 |

---

## 紧急回滚预案

| 故障场景 | 回滚方法 | RTO |
|---|---|---|
| 前端白屏 | 替换 dist/ 为上一版本（git checkout v0.12.0 -- dist/） | 5 分钟 |
| 内核崩溃 | `docker compose down && docker compose up -d` | 3 分钟 |
| 数据损坏 | 从阶段一的备份恢复 | 30 分钟 |
| Nginx 配置错误 | 恢复 nginx.conf.backup，nginx -t && nginx -s reload | 2 分钟 |

---

## 检查清单（打印版，每次更新打勾）

### 更新前
- [ ] 代码已全部 commit + push 到 main
- [ ] 本地冒烟测试通过
- [ ] 服务器数据卷已备份
- [ ] `.env.backup` 已创建
- [ ] git tag 已打

### 更新中
- [ ] 版本标识（build_id）已生成并注入
- [ ] Docker 镜像构建无缓存
- [ ] 三容器 status = healthy
- [ ] 健康检查三端 version + build 一致

### 更新后
- [ ] 云端 8 项功能验证全过
- [ ] 桌面端 4 项功能验证全过
- [ ] 双端版本锚点比对一致
- [ ] readme.md 已更新
- [ ] debug_log 已追加
- [ ] 已通知用户

### 回滚时
- [ ] 回滚原因已记录
- [ ] 数据已恢复
- [ ] 根因已分析
- [ ] 改进项已列入下一次迭代
