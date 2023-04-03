import { defineUserConfig } from "vuepress";
import theme from "./theme.js";
import { hopeTheme } from "vuepress-theme-hope";

export default defineUserConfig({
  base: "/",

  locales: {
    "/": {
      lang: "zh-CN",
      title: "码农参上",
      description: "哈哈哈哈哈嗝~",
    },
  },

  theme,

 // theme: hopeTheme({
 //   // 关键词: "iconfont", "iconify", "fontawesome", "fontawesome-with-brands"
 //   iconAssets: "iconfont",
 // 
 //   // 你想要的 URL
 //   //iconAssets: "//at.alicdn.com/t/c/font_3991368_1uiy7x9mf65.js",
 // 
 //   // 上述内容的数组
 //   //iconAssets: ["iconfont", "//at.alicdn.com/t/c/font_3991368_vxizcbrqaoo.css"],
 // }),
  
  // Enable it with pwa
  // shouldPrefetch: false,
});
