# 《暗流涌动》美术资源规格与交付清单

本文件是后期替换背景、广场、角色标记、UI 和手书动画的唯一尺寸清单。
素材放入 `apps/web/public/assets/user/`，保持下表文件名不变即可自动接入。
缺少任何文件时，程序都会继续使用 CSS 占位效果。

## 通用规范

- 桌面设计基准：`1920 × 1080`；桌面背景交付：`2560 × 1440`。
- 移动设计基准：`390 × 844`，兼容至 `430 × 932`；移动背景交付：`1440 × 2560`。
- 色彩空间统一为 sRGB。
- 透明图优先 WebP；需要无损源文件时同时保留 PNG/PSD。
- 图标优先 SVG；所有位图避免内嵌界面文字。
- 背景关键内容放在中央 60% 安全区，允许左右或上下裁切。
- 文件名只用小写英文、数字和连字符。

## 背景

| 完成 | 文件名 | 尺寸 | 格式 | 裁切/显示 |
|---|---|---:|---|---|
| [ ] | `background-lobby-desktop.webp` | 2560 × 1440 | WebP/JPG | `cover`，中央安全区 |
| [ ] | `background-lobby-mobile.webp` | 1440 × 2560 | WebP/JPG | `cover`，主体居中 |
| [ ] | `background-day-desktop.webp` | 2560 × 1440 | WebP/JPG | `cover` |
| [ ] | `background-day-mobile.webp` | 1440 × 2560 | WebP/JPG | `cover` |
| [ ] | `background-night-desktop.webp` | 2560 × 1440 | WebP/JPG | `cover` |
| [ ] | `background-night-mobile.webp` | 1440 × 2560 | WebP/JPG | `cover` |
| [ ] | `background-review-desktop.webp` | 2560 × 1440 | WebP/JPG | `cover` |
| [ ] | `background-review-mobile.webp` | 1440 × 2560 | WebP/JPG | `cover` |

每张桌面背景建议不超过 1.5 MB，移动背景建议不超过 1 MB。

## 广场与魔典

| 完成 | 文件名 | 尺寸 | 格式 | 安全区/用途 |
|---|---|---:|---|---|
| [ ] | `town-square.webp` | 2048 × 2048 | 透明 WebP/PNG | 核心圆形直径约 1700 px |
| [ ] | `town-foreground.webp` | 2048 × 2048 | 透明 WebP/PNG | 不遮挡环形座位 |
| [ ] | `emblem-day.webp` | 1024 × 1024 | 透明 WebP/PNG/SVG | 中央日间徽记 |
| [ ] | `emblem-night.webp` | 1024 × 1024 | 透明 WebP/PNG/SVG | 中央夜间徽记 |
| [ ] | `seat-nameplate.webp` | 1024 × 512 | 透明 WebP/PNG | 中间 50% 可水平拉伸 |
| [ ] | `panel-texture.webp` | 1024 × 1024 | WebP | 无缝平铺，≤ 500 KB |
| [ ] | `topbar-decoration.webp` | 2048 × 256 | 透明 WebP/PNG | 可横向裁切 |
| [ ] | `modal-frame.png` | 1600 × 1200 | 透明 PNG | 中央 70% 透明 |

## 角色标记

每个角色交付 `1024 × 1024` 透明 WebP/PNG，主体位于中央 `900 × 900`
圆形安全区。文件名格式为 `role-{角色 ID}.webp`。

- [ ] `role-washerwoman.webp`
- [ ] `role-librarian.webp`
- [ ] `role-investigator.webp`
- [ ] `role-chef.webp`
- [ ] `role-empath.webp`
- [ ] `role-fortune-teller.webp`
- [ ] `role-undertaker.webp`
- [ ] `role-monk.webp`
- [ ] `role-ravenkeeper.webp`
- [ ] `role-virgin.webp`
- [ ] `role-slayer.webp`
- [ ] `role-soldier.webp`
- [ ] `role-mayor.webp`
- [ ] `role-butler.webp`
- [ ] `role-drunk.webp`
- [ ] `role-recluse.webp`
- [ ] `role-saint.webp`
- [ ] `role-poisoner.webp`
- [ ] `role-spy.webp`
- [ ] `role-scarlet-woman.webp`
- [ ] `role-baron.webp`
- [ ] `role-imp.webp`
- [ ] `role-back-good.webp`（善良角色背面）
- [ ] `role-back-evil.webp`（邪恶角色背面）

## 状态与提醒图标

每个图标交付 `256 × 256` SVG 或透明 PNG/WebP，主体安全区 `224 × 224`。

- [ ] `status-alive.svg`
- [ ] `status-dead.svg`
- [ ] `status-dead-vote.svg`
- [ ] `status-drunk.svg`
- [ ] `status-poisoned.svg`
- [ ] `status-protected.svg`
- [ ] `status-ability-used.svg`
- [ ] `status-red-herring.svg`
- [ ] `status-master.svg`
- [ ] `status-custom.svg`
- [ ] `status-online.svg`
- [ ] `status-offline.svg`

## 品牌与发布资源

| 完成 | 文件名 | 尺寸 | 格式 |
|---|---|---:|---|
| [ ] | `app-logo.svg` | 1024 × 1024 画布 | SVG/透明 PNG |
| [ ] | `app-wordmark.svg` | 1600 × 400 画布 | SVG/透明 PNG |
| [ ] | `og-image.webp` | 1200 × 630 | WebP/JPG |
| [ ] | `icon-512.png` | 512 × 512 | PNG |
| [ ] | `icon-192.png` | 192 × 192 | PNG |
| [ ] | `apple-touch-icon.png` | 180 × 180 | PNG |
| [ ] | `icon-maskable-512.png` | 512 × 512 | PNG；主体在中央 409 × 409 |

## 手书动画

推荐 24 FPS。优先交付带透明通道的 VP9 WebM；不需要透明时使用 H.264
MP4。每个动画再交一张同尺寸 WebP 海报作为低性能设备回退。

| 完成 | 文件名 | 时长 | 画布 | 说明 |
|---|---|---:|---:|---|
| [ ] | `animation-intro.webm` | 3–6 秒 | 1920 × 1080 | 开场，可跳过 |
| [ ] | `animation-nightfall.webm` | 2–4 秒 | 1920 × 1080 | 入夜 |
| [ ] | `animation-dawn.webm` | 2–4 秒 | 1920 × 1080 | 黎明 |
| [ ] | `animation-nomination.webm` | 1–2 秒 | 1920 × 1080 | 发起提名 |
| [ ] | `animation-execution.webm` | 2–4 秒 | 1920 × 1080 | 处决，避免血腥画面 |
| [ ] | `animation-death.webm` | 1–2 秒 | 1024 × 1024 | 局部透明动画 |
| [ ] | `animation-good-win.webm` | 3–5 秒 | 1920 × 1080 | 善良胜利 |
| [ ] | `animation-evil-win.webm` | 3–5 秒 | 1920 × 1080 | 邪恶胜利 |

对应海报沿用相同名字并将扩展名改为 `.webp`。如果使用 PNG 序列：

```text
animation-name/
  frame-0001.png
  frame-0002.png
  ...
```

移动端直接裁切桌面动画，所有关键信息需位于中央 `1152 × 1080` 区域。

## 接入验收

- [ ] 文件名、像素尺寸和透明通道符合清单。
- [ ] 桌面 16:9、移动竖屏均无关键内容被裁掉。
- [ ] 背景没有烘焙文字。
- [ ] 广场前景不会覆盖座位按钮和投票操作。
- [ ] 动画支持跳过，且关闭动画后流程不受影响。
- [ ] 系统“减少动态效果”开启时只显示动画海报。
- [ ] 删除全部自定义素材后，CSS 占位界面仍可完整使用。
