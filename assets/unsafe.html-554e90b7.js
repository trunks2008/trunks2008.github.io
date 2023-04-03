const e=JSON.parse('{"key":"v-89724602","path":"/advanced/unsafe.html","title":"Java双刃剑之Unsafe类详解","lang":"zh-CN","frontmatter":{"title":"Java双刃剑之Unsafe类详解","icon":"page","order":1,"author":"Hydra","date":"2021-04-29T00:00:00.000Z","tag":["unsafe"],"star":true,"description":"前一段时间在研究juc源码的时候，发现在很多工具类中都调用了一个Unsafe类中的方法，出于好奇就想要研究一下这个类到底有什么作用，于是先查阅了一些资料，一查不要紧，很多资料中对Unsafe的态度都是这样的画风： 0hh.jpg 其实看到这些说法也没什么意外，毕竟Unsafe这个词直译过来就是“不安全的”，从名字里我们也大概能看来Java的开发者们对它...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/advanced/unsafe.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"Java双刃剑之Unsafe类详解"}],["meta",{"property":"og:description","content":"前一段时间在研究juc源码的时候，发现在很多工具类中都调用了一个Unsafe类中的方法，出于好奇就想要研究一下这个类到底有什么作用，于是先查阅了一些资料，一查不要紧，很多资料中对Unsafe的态度都是这样的画风： 0hh.jpg 其实看到这些说法也没什么意外，毕竟Unsafe这个词直译过来就是“不安全的”，从名字里我们也大概能看来Java的开发者们对它..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"unsafe"}],["meta",{"property":"article:published_time","content":"2021-04-29T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Java双刃剑之Unsafe类详解\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2021-04-29T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":3,"title":"Unsafe 基础","slug":"unsafe-基础","link":"#unsafe-基础","children":[]},{"level":3,"title":"Unsafe 应用","slug":"unsafe-应用","link":"#unsafe-应用","children":[]},{"level":3,"title":"总结","slug":"总结","link":"#总结","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":23.88,"words":7164},"filePathRelative":"advanced/unsafe.md","localizedDate":"2021年4月29日","autoDesc":true}');export{e as data};