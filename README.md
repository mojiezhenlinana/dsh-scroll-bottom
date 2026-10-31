# dsh-scroll-bottom

给 DeepSeek Harness 的 Web 界面加一个「一键回到底部」的圆形按钮，贴在输入框上方中间。

往上翻历史看完之后，不用再手动滑回去。

## 行为

- 往上翻超过 120px 才出现，已经在底部时自动隐去
- 点一下平滑滚回最新消息
- 位置按输入框真实坐标算（不是窗口居中），窗口缩放、侧栏变化都会重新贴位
- 白色毛玻璃外观，不依赖主题色，深色/浅色界面都看得清
- 纯前端，不注册任何工具、不读写任何数据、不发任何请求

## 安装

```sh
dsh plugin --profile web add github:<你的用户名>/dsh-scroll-bottom
```

桌面端把 `web` 换成对应的 profile 名，安装前先退出宿主，装完重启。

也可以手动装：把整个目录放进 `~/.dsh/profiles/<profile>/node_modules/dsh-scroll-bottom`，
然后在 profile 的 `package.json` 里：

```jsonc
"dependencies": { "dsh-scroll-bottom": "file:<路径>" },
"dsh": { "profile": { "bundles": [ /* ... */, "dsh-scroll-bottom" ] } }
```

## 实现

- `lib/index.js` —— 宿主半边，空实现（只为满足 loader 契约：导出 `name` + `apply`）
- `lib/client.js` —— 浏览器半边：建按钮、定位、显隐判断、滚动、样式
- `cordis.patch.yml` —— 一行 bundle 补丁

用的宿主锚点（DSH 0.2.x）：

| 锚点 | 用途 |
|---|---|
| `[data-conversation-scroll]` | 对话滚动容器 |
| `[data-composer-seat]` | 输入框所在的 sticky 座 |
| `[data-chat-flow]` / `[data-chat-flow-key]` | 消息行（兜底定位滚动容器） |

## 已知取舍

- 用 `clip-path: circle(50%)` 裁的圆：主题对 `button` 的圆角规则常常优先级更高，裁剪不受影响。
  代价是按钮外侧的阴影会被一起裁掉。
- 挂载时会先清掉自己上一次注入的节点与样式，避免热加载时出现叠影。

## License

MIT
