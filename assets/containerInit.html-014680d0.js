const e=JSON.parse('{"key":"v-77e0d69e","path":"/spring/containerInit.html","title":"Spring容器初始化源码解析","lang":"zh-CN","frontmatter":{"title":"Spring容器初始化源码解析","icon":"page","order":1,"author":"Hydra","date":"2020-06-16T00:00:00.000Z","tag":["Spring"],"star":true,"description":"Spring框架被广泛应用于我们的日常工作中，但是很长时间以来我都是只会使用，不懂它的作用原理。通过最近一段时间的阅读源码，个人发现通过阅读源码，能够帮助我们了解Spring的设计理念，并且对Java编程中的一些设计模式更加熟悉，所以记录一下自己对Spring源码的理解。 在开始进行源码学习前，首先再回顾一下三种Spring编程风格： 基于Schema...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/spring/containerInit.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"Spring容器初始化源码解析"}],["meta",{"property":"og:description","content":"Spring框架被广泛应用于我们的日常工作中，但是很长时间以来我都是只会使用，不懂它的作用原理。通过最近一段时间的阅读源码，个人发现通过阅读源码，能够帮助我们了解Spring的设计理念，并且对Java编程中的一些设计模式更加熟悉，所以记录一下自己对Spring源码的理解。 在开始进行源码学习前，首先再回顾一下三种Spring编程风格： 基于Schema..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"Spring"}],["meta",{"property":"article:published_time","content":"2020-06-16T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Spring容器初始化源码解析\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2020-06-16T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"构造方法","slug":"构造方法","link":"#构造方法","children":[]},{"level":2,"title":"register方法","slug":"register方法","link":"#register方法","children":[]},{"level":2,"title":"refresh 方法","slug":"refresh-方法","link":"#refresh-方法","children":[{"level":3,"title":"1、prepareRefresh","slug":"_1、preparerefresh","link":"#_1、preparerefresh","children":[]},{"level":3,"title":"2、obtainFreshBeanFactory","slug":"_2、obtainfreshbeanfactory","link":"#_2、obtainfreshbeanfactory","children":[]},{"level":3,"title":"3、prepareBeanFactory","slug":"_3、preparebeanfactory","link":"#_3、preparebeanfactory","children":[]},{"level":3,"title":"4、postProcessBeanFactory","slug":"_4、postprocessbeanfactory","link":"#_4、postprocessbeanfactory","children":[]},{"level":3,"title":"5、invokeBeanFactoryPostProcessors","slug":"_5、invokebeanfactorypostprocessors","link":"#_5、invokebeanfactorypostprocessors","children":[]},{"level":3,"title":"6、registerBeanPostProcessors","slug":"_6、registerbeanpostprocessors","link":"#_6、registerbeanpostprocessors","children":[]},{"level":3,"title":"7、非重点部分","slug":"_7、非重点部分","link":"#_7、非重点部分","children":[]}]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":17.85,"words":5355},"filePathRelative":"spring/containerInit.md","localizedDate":"2020年6月16日","autoDesc":true}');export{e as data};