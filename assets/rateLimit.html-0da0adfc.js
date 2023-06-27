const e=JSON.parse('{"key":"v-362e617d","path":"/concurrent/rateLimit.html","title":"服务限流，我有6种实现方式…","lang":"zh-CN","frontmatter":{"title":"服务限流，我有6种实现方式…","icon":"page","order":9,"author":"Hydra","date":"2023-05-10T00:00:00.000Z","tag":["并发","限流"],"star":true,"description":"哈喽大家好啊，我是Hydra，今天来和大家聊聊服务的限流。 服务限流，是指通过控制请求的速率或次数来达到保护服务的目的，在微服务中，我们通常会将它和熔断、降级搭配在一起使用，来避免瞬时的大量请求对系统造成负荷，来达到保护服务平稳运行的目的。下面就来看一看常见的6种限流方式，以及它们的实现与使用。 固定窗口算法 固定窗口算法通过在单位时间内维护一个计数器...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/concurrent/rateLimit.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"服务限流，我有6种实现方式…"}],["meta",{"property":"og:description","content":"哈喽大家好啊，我是Hydra，今天来和大家聊聊服务的限流。 服务限流，是指通过控制请求的速率或次数来达到保护服务的目的，在微服务中，我们通常会将它和熔断、降级搭配在一起使用，来避免瞬时的大量请求对系统造成负荷，来达到保护服务平稳运行的目的。下面就来看一看常见的6种限流方式，以及它们的实现与使用。 固定窗口算法 固定窗口算法通过在单位时间内维护一个计数器..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-06-27T09:02:57.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"并发"}],["meta",{"property":"article:tag","content":"限流"}],["meta",{"property":"article:published_time","content":"2023-05-10T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-06-27T09:02:57.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"服务限流，我有6种实现方式…\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2023-05-10T00:00:00.000Z\\",\\"dateModified\\":\\"2023-06-27T09:02:57.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"固定窗口算法","slug":"固定窗口算法","link":"#固定窗口算法","children":[]},{"level":2,"title":"滑动窗口算法","slug":"滑动窗口算法","link":"#滑动窗口算法","children":[]},{"level":2,"title":"漏桶算法","slug":"漏桶算法","link":"#漏桶算法","children":[]},{"level":2,"title":"令牌桶算法","slug":"令牌桶算法","link":"#令牌桶算法","children":[]},{"level":2,"title":"中间件限流","slug":"中间件限流","link":"#中间件限流","children":[]},{"level":2,"title":"网关限流","slug":"网关限流","link":"#网关限流","children":[]},{"level":2,"title":"总结","slug":"总结","link":"#总结","children":[]}],"git":{"createdTime":1687856577000,"updatedTime":1687856577000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":13.64,"words":4091},"filePathRelative":"concurrent/rateLimit.md","localizedDate":"2023年5月10日","autoDesc":true}');export{e as data};