/**
 * 宿主半边：这个插件只在浏览器里画一个按钮，宿主侧没有任何路由或服务。
 * cordis 的 loader 按 patch 行的 `name` 加载本包，要求导出 name + apply。
 */
export const name = 'dsh-scroll-bottom'

/** 什么都不做：没有需要注册的宿主能力。 */
export function apply() {}
