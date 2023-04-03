const e=JSON.parse('{"key":"v-6253370a","path":"/mybatis/executeProcess.html","title":"MyBatis 执行流程及源码解析","lang":"zh-CN","frontmatter":{"title":"MyBatis 执行流程及源码解析","icon":"page","order":1,"author":"Hydra","date":"2021-10-13T00:00:00.000Z","tag":["MyBatis","源码解析"],"sticky":false,"star":true,"description":"我们在日常工作中广泛使用mybatis作为数据持久层框架，但是mybatis的执行流程是怎么样的，你了解过吗。本文将从源码角度，带你分析mybatis的工作原理。 先看一个简单的例子，以Service调用Mapper接口为，先写一个简单的Mapper： 在Servie中调用Mapper的方法： 向Service中注入这个Mapper并调用时，你知道这时...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/mybatis/executeProcess.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"MyBatis 执行流程及源码解析"}],["meta",{"property":"og:description","content":"我们在日常工作中广泛使用mybatis作为数据持久层框架，但是mybatis的执行流程是怎么样的，你了解过吗。本文将从源码角度，带你分析mybatis的工作原理。 先看一个简单的例子，以Service调用Mapper接口为，先写一个简单的Mapper： 在Servie中调用Mapper的方法： 向Service中注入这个Mapper并调用时，你知道这时..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"MyBatis"}],["meta",{"property":"article:tag","content":"源码解析"}],["meta",{"property":"article:published_time","content":"2021-10-13T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"MyBatis 执行流程及源码解析\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2021-10-13T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":3,"title":"一、配置SqlSessionFactoryBean 时都做了什么？","slug":"一、配置sqlsessionfactorybean-时都做了什么","link":"#一、配置sqlsessionfactorybean-时都做了什么","children":[]},{"level":3,"title":"二、@MapperScan都做了什么？","slug":"二、-mapperscan都做了什么","link":"#二、-mapperscan都做了什么","children":[]},{"level":3,"title":"三、mybatis如何生成代理对象？","slug":"三、mybatis如何生成代理对象","link":"#三、mybatis如何生成代理对象","children":[]},{"level":3,"title":"四、MapperProxy代理对象如何执行sql语句？","slug":"四、mapperproxy代理对象如何执行sql语句","link":"#四、mapperproxy代理对象如何执行sql语句","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":4.95,"words":1486},"filePathRelative":"mybatis/executeProcess.md","localizedDate":"2021年10月13日","autoDesc":true}');export{e as data};