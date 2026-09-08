# 上传「伊瑟利亚·核心」到 GitHub（私有仓库）完整步骤

> 你的电脑已经装好 Git，项目也已经是 git 仓库，只差：注册账号 → 建仓库 → 提交 → 推送。

---

## 第一步：注册 GitHub 账号（约 3 分钟）

1. 打开浏览器，访问 **https://github.com**
2. 点击右上角 **Sign up**（注册）
3. 按提示填写：
   - **Email**：你的邮箱（建议用常用邮箱，如 QQ/163 邮箱都行）
   - **Password**：密码（至少 8 位）
   - **Username**：用户名 —— 这是你的公开身份，以后仓库地址里会用到（例如 `xxx/isellia-core`），建议用拼音或英文（如 `yiseliyawang`）
4. 按提示完成人机验证（拼图之类）
5. 注册后 GitHub 会给你发一封验证邮件，**去邮箱点确认链接**（必须点，否则无法使用）
6. 登录进去，GitHub 会问一些个性化问题（要不要装工具等），**全部可以跳过**（Skip）

✅ 注册完成。接下来创建仓库。

---

## 第二步：创建私有仓库（约 1 分钟）

1. 登录后，点右上角 **+** 号 → **New repository**（新建仓库）
2. **Repository name**：填仓库名，例如 `isellia-core`（只能用英文/数字/横线）
3. **Description**（描述，可不填）：伊瑟利亚核心脚本
4. **可见性**：选 **Private**（私有，只有你能看）← 重要
5. **不要勾选** "Add a README file"（保持空仓库，避免和本地冲突）
6. 点底部绿色按钮 **Create repository**

✅ 建好后页面会显示一些命令，**先别关这个页面**，等会儿要用（那里有你的仓库地址）。

---

## 第三步：配置本地身份（只需一次）

打开 PowerShell（按 `Win` 键，输入 powershell，回车），复制粘贴这两行，把内容换成**你的** GitHub 用户名和注册邮箱：

```powershell
git config --global user.name "你的GitHub用户名"
git config --global user.email "你注册GitHub用的邮箱"
```

> 例如：`git config --global user.name "yiseliyawang"`

✅ 配置完成。

---

## 第四步：只暂存「伊瑟利亚·核心」并提交（在项目文件夹里执行）

先进入项目文件夹，然后逐条执行：

```powershell
cd G:\酒馆\tavern_helper_template-main

git reset
git add "dist/伊瑟利亚/核心"
git commit -m "伊瑟利亚核心脚本：状态栏/首页/升级/变量规则/变量结构"
```

每一步的意思：
- `git reset`：清空暂存区（**不会删除任何文件**，只是取消暂存，防止把整个项目误传上去）
- `git add "dist/伊瑟利亚/核心"`：只把核心目录这 5 个文件放进待提交名单
- `git commit -m "..."`：正式提交（引号里是提交说明，可自己改）

✅ 提交完成。

---

## 第五步：关联 GitHub 仓库并推送

回到第二步那个 GitHub 页面，复制它的仓库地址（形如 `https://github.com/你的用户名/isellia-core.git`），然后执行：

```powershell
git remote add origin https://github.com/你的用户名/isellia-core.git
git branch -M main
git push -u origin main
```

**推送时**：会自动弹出 GitHub 登录窗口（浏览器）——用你刚注册的账号登录并授权一次即可，之后就不用再登了。

看到类似 `main -> main`、`done` 的字样 = 推送成功 🎉

---

## 以后每次改完代码怎么更新（日常三连）

```powershell
cd G:\酒馆\tavern_helper_template-main
git add "dist/伊瑟利亚/核心"
git commit -m "这次改了什么，简单写一下"
git push
```

> 想偷懒的话，也可以只执行：
> ```powershell
> git add "dist/伊瑟利亚/核心" && git commit -m "更新" && git push
> ```
> （一条命令搞定，`&&` 表示依次执行）

---

## 常见问题

**Q：push 时报错 "failed to push some refs"？**
A：一般是远程有东西本地没有。如果仓库是刚建的空仓库，检查第二步是否误勾选了 README；勾了就删掉远程仓库重建（或告诉我帮你处理）。

**Q：push 时要求输入用户名密码？**
A：GitHub 现在用"个人访问令牌"（PAT）代替密码。更省事的方式：在 GitHub 网页 → 右上角头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**，勾选 `repo` 权限，生成后复制，push 时密码框粘贴它即可（只填一次，Windows 会记住）。

**Q：传上去后发现传错了文件？**
A：只要还没 push 就有救，告诉我，我帮你改。

---

## 小提示

- 仓库是**私有**的，别人看不到，放心传；以后想公开分享，在 GitHub 仓库页面 → **Settings** → 拉到底 → **Danger Zone** → **Change visibility** 一键改公开。
- 你的项目里还有 初始模板/示例/src 等其它内容，这次**只传核心**，其他不动；以后想传别的目录，把第四步的路径换成那个目录即可。
