const e=JSON.parse('{"key":"v-2584bdab","path":"/redis/distribute.html","title":"Redis实现分布式锁","lang":"zh-CN","frontmatter":{"title":"Redis实现分布式锁","icon":"page","order":7,"author":"Hydra","date":"2020-08-09T00:00:00.000Z","tag":["分布式锁","Redis"],"star":true,"description":"在之前并发系列的文章中，我们介绍了JVM中的锁。但是无论是synchronized还是Lock，都运行在线程级别上，必须运行在同一个JVM中。如果竞争资源的进程不在同一个JVM中时，这样线程锁就无法起到作用，必须使用分布式锁来控制多个进程对资源的访问。 分布式锁的实现一般有三种方式，使用MySql数据库行锁，基于Redis的分布式锁，以及基于Zooke...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/redis/distribute.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"Redis实现分布式锁"}],["meta",{"property":"og:description","content":"在之前并发系列的文章中，我们介绍了JVM中的锁。但是无论是synchronized还是Lock，都运行在线程级别上，必须运行在同一个JVM中。如果竞争资源的进程不在同一个JVM中时，这样线程锁就无法起到作用，必须使用分布式锁来控制多个进程对资源的访问。 分布式锁的实现一般有三种方式，使用MySql数据库行锁，基于Redis的分布式锁，以及基于Zooke..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"分布式锁"}],["meta",{"property":"article:tag","content":"Redis"}],["meta",{"property":"article:published_time","content":"2020-08-09T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Redis实现分布式锁\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2020-08-09T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"手写Redis分布式锁","slug":"手写redis分布式锁","link":"#手写redis分布式锁","children":[]},{"level":2,"title":"Redisson","slug":"redisson","link":"#redisson","children":[{"level":3,"title":"lock()","slug":"lock","link":"#lock","children":[]},{"level":3,"title":"lock(long leaseTime, TimeUnit unit)","slug":"lock-long-leasetime-timeunit-unit","link":"#lock-long-leasetime-timeunit-unit","children":[]},{"level":3,"title":"tryLock(long waitTime, long leaseTime, TimeUnit unit)","slug":"trylock-long-waittime-long-leasetime-timeunit-unit","link":"#trylock-long-waittime-long-leasetime-timeunit-unit","children":[]}]},{"level":2,"title":"RedLock红锁","slug":"redlock红锁","link":"#redlock红锁","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":6.1,"words":1831},"filePathRelative":"redis/distribute.md","localizedDate":"2020年8月9日","autoDesc":true}');export{e as data};