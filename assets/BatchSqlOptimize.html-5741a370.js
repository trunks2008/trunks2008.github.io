const e=JSON.parse('{"key":"v-257ea03c","path":"/mysql/BatchSqlOptimize.html","title":"批量SQL优化实战","lang":"zh-CN","frontmatter":{"title":"批量SQL优化实战","icon":"page","order":5,"author":"Hydra","date":"2021-01-24T00:00:00.000Z","tag":["SQL优化"],"star":true,"description":"有时在工作中，我们需要将大量的数据持久化到数据库中，如果数据量很大的话直接插入的执行速度非常慢，并且由于插入操作也没有太多能够进行sql优化的地方，所以只能从程序代码的角度进行优化。所以本文将尝试使用几种不同方式对插入操作进行优化，看看如何能够最大程度的缩短SQL执行时间。 以插入1000条数据为例，首先进行数据准备，用于插入数据库测试： 其中调用了e...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/mysql/BatchSqlOptimize.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"批量SQL优化实战"}],["meta",{"property":"og:description","content":"有时在工作中，我们需要将大量的数据持久化到数据库中，如果数据量很大的话直接插入的执行速度非常慢，并且由于插入操作也没有太多能够进行sql优化的地方，所以只能从程序代码的角度进行优化。所以本文将尝试使用几种不同方式对插入操作进行优化，看看如何能够最大程度的缩短SQL执行时间。 以插入1000条数据为例，首先进行数据准备，用于插入数据库测试： 其中调用了e..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"SQL优化"}],["meta",{"property":"article:published_time","content":"2021-01-24T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"批量SQL优化实战\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2021-01-24T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":3,"title":"直接插入","slug":"直接插入","link":"#直接插入","children":[]},{"level":3,"title":"mybatis-plus 批量插入","slug":"mybatis-plus-批量插入","link":"#mybatis-plus-批量插入","children":[]},{"level":3,"title":"并行流","slug":"并行流","link":"#并行流","children":[]},{"level":3,"title":"Fork/Join","slug":"fork-join","link":"#fork-join","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":5.4,"words":1619},"filePathRelative":"mysql/BatchSqlOptimize.md","localizedDate":"2021年1月24日","autoDesc":true}');export{e as data};
