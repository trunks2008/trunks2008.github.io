import { navbar } from "vuepress-theme-hope";

export const zhNavbar = navbar([
  //"/",
  {link:"/",icon:"home",text:"首页"},
  { 
	text: "文章", 
	icon: "discover", 
	link: "/spring/containerInit.html/" 
  }
//  ,
//  {
//    text: "指南",
//    icon: "creative",
//    prefix: "/guide/",
//    children: [
//      {
//        text: "Bar",
//        icon: "creative",
//        prefix: "bar/",
//        children: ["baz", { text: "...", icon: "more", link: "" }],
//      },
//      {
//        text: "Foo",
//        icon: "config",
//        prefix: "foo/",
//        children: ["ray", { text: "...", icon: "more", link: "" }],
//      },
//    ],
//  }
//  ,
//  {
//    text: "V2 文档",
//    icon: "note",
//    link: "https://theme-hope.vuejs.press/zh/",
//  },
]);
