const e=JSON.parse('{"key":"v-c1badcfa","path":"/spring/InitializateBean.html","title":"Spring实例化Bean源码解析","lang":"zh-CN","frontmatter":{"title":"Spring实例化Bean源码解析","icon":"page","order":2,"author":"Hydra","date":"2020-06-18T00:00:00.000Z","tag":["Spring","Bean"],"star":true,"description":"在前一篇文章中，我们说完了Spring环境初始化的过程，接下来讲一下Bean的实例化过程。这篇文章中，暂时不对Bean循环依赖的情况进行分析，因为比较复杂，会放在后面单独的文章中进行分析。 准备工作 接着从上篇文章中没有讲完的AnnotationConfigApplicationContext类的refresh方法开始分析，从下面这条语句开始： 从官方...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/spring/InitializateBean.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"Spring实例化Bean源码解析"}],["meta",{"property":"og:description","content":"在前一篇文章中，我们说完了Spring环境初始化的过程，接下来讲一下Bean的实例化过程。这篇文章中，暂时不对Bean循环依赖的情况进行分析，因为比较复杂，会放在后面单独的文章中进行分析。 准备工作 接着从上篇文章中没有讲完的AnnotationConfigApplicationContext类的refresh方法开始分析，从下面这条语句开始： 从官方..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"Spring"}],["meta",{"property":"article:tag","content":"Bean"}],["meta",{"property":"article:published_time","content":"2020-06-18T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"Spring实例化Bean源码解析\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2020-06-18T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"准备工作","slug":"准备工作","link":"#准备工作","children":[]},{"level":2,"title":"实例化bean","slug":"实例化bean","link":"#实例化bean","children":[{"level":3,"title":"1、AbstractBeanFactory 的 doGetBean方法：","slug":"_1、abstractbeanfactory-的-dogetbean方法","link":"#_1、abstractbeanfactory-的-dogetbean方法","children":[]},{"level":3,"title":"2、AbstractAutowireCapableBeanFactory 的 createBean方法：","slug":"_2、abstractautowirecapablebeanfactory-的-createbean方法","link":"#_2、abstractautowirecapablebeanfactory-的-createbean方法","children":[]},{"level":3,"title":"3、AbstractAutowireCapableBeanFactory 的 doCreateBean方法：","slug":"_3、abstractautowirecapablebeanfactory-的-docreatebean方法","link":"#_3、abstractautowirecapablebeanfactory-的-docreatebean方法","children":[]},{"level":3,"title":"4、AbstractAutowireCapableBeanFactory 的 createBeanInstance方法：","slug":"_4、abstractautowirecapablebeanfactory-的-createbeaninstance方法","link":"#_4、abstractautowirecapablebeanfactory-的-createbeaninstance方法","children":[]},{"level":3,"title":"5、AbstractAutowireCapableBeanFactory 的 instantiateBean方法：","slug":"_5、abstractautowirecapablebeanfactory-的-instantiatebean方法","link":"#_5、abstractautowirecapablebeanfactory-的-instantiatebean方法","children":[]},{"level":3,"title":"6、SimpleInstantiationStrategy 的 instantiate方法：","slug":"_6、simpleinstantiationstrategy-的-instantiate方法","link":"#_6、simpleinstantiationstrategy-的-instantiate方法","children":[]}]},{"level":2,"title":"属性填充","slug":"属性填充","link":"#属性填充","children":[]},{"level":2,"title":"执行回调方法及后置处理器","slug":"执行回调方法及后置处理器","link":"#执行回调方法及后置处理器","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":15.43,"words":4630},"filePathRelative":"spring/InitializateBean.md","localizedDate":"2020年6月18日","autoDesc":true}');export{e as data};
