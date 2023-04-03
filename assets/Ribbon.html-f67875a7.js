const e=JSON.parse('{"key":"v-ae31297a","path":"/springcloud/Ribbon.html","title":"Ribbon核心源码解析","lang":"zh-CN","frontmatter":{"title":"Ribbon核心源码解析","icon":"page","order":2,"author":"Hydra","date":"2020-05-29T00:00:00.000Z","tag":["Spring Cloud","Ribbon"],"star":true,"description":"Spring cloud Ribbon是基于Netflix Ribbon实现的一套客户端负载均衡工具，简单的说，它能够使用负载均衡器基于某种规则或算法调用我们的微服务集群，并且我们也可以很容易地使用Ribbon实现自定义负载均衡算法。 在之前使用Eureka的过程中，需要导入对应的依赖，但是Ribbon有一点特殊，不需要引入依赖也可以使用。这是因为在E...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/springcloud/Ribbon.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"Ribbon核心源码解析"}],["meta",{"property":"og:description","content":"Spring cloud Ribbon是基于Netflix Ribbon实现的一套客户端负载均衡工具，简单的说，它能够使用负载均衡器基于某种规则或算法调用我们的微服务集群，并且我们也可以很容易地使用Ribbon实现自定义负载均衡算法。 在之前使用Eureka的过程中，需要导入对应的依赖，但是Ribbon有一点特殊，不需要引入依赖也可以使用。这是因为在E..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"Spring Cloud"}],["meta",{"property":"article:tag","content":"Ribbon"}],["meta",{"property":"article:published_time","content":"2020-05-29T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Ribbon核心源码解析\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2020-05-29T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"调用流程","slug":"调用流程","link":"#调用流程","children":[]},{"level":2,"title":"负载均衡过程","slug":"负载均衡过程","link":"#负载均衡过程","children":[]},{"level":2,"title":"核心组件ILoadBalancer","slug":"核心组件iloadbalancer","link":"#核心组件iloadbalancer","children":[{"level":3,"title":"服务获取","slug":"服务获取","link":"#服务获取","children":[]},{"level":3,"title":"服务选取","slug":"服务选取","link":"#服务选取","children":[]}]},{"level":2,"title":"总结","slug":"总结","link":"#总结","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":11.96,"words":3588},"filePathRelative":"springcloud/Ribbon.md","localizedDate":"2020年5月29日","autoDesc":true}');export{e as data};