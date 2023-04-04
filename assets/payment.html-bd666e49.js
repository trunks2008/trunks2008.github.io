const e=JSON.parse('{"key":"v-26b42743","path":"/wechat/payment.html","title":"微信小程序支付流程详解","lang":"zh-CN","frontmatter":{"title":"微信小程序支付流程详解","icon":"page","order":2,"author":"Hydra","date":"2020-11-22T00:00:00.000Z","tag":["微信","支付"],"star":true,"description":"最近在工作中接入了一下微信小程序支付的功能，虽然说官方文档已经比较详细了，但在使用过程中还是踩了不少的坑，整理了一下大体的流程和代码分享出来。在开始使用小程序支付功能前，需要做好以下的准备工作： 申请微信小程序，配置小程序id及秘钥; 申请用于支付的微信商户平台账号，配置商户号id及商户平台秘钥，并绑定小程序与该商户号; 后端服务在正式环境下需要htt...","head":[["meta",{"property":"og:url","content":"https://vuepress-theme-hope-docs-demo.netlify.app/wechat/payment.html"}],["meta",{"property":"og:site_name","content":"码农参上"}],["meta",{"property":"og:title","content":"微信小程序支付流程详解"}],["meta",{"property":"og:description","content":"最近在工作中接入了一下微信小程序支付的功能，虽然说官方文档已经比较详细了，但在使用过程中还是踩了不少的坑，整理了一下大体的流程和代码分享出来。在开始使用小程序支付功能前，需要做好以下的准备工作： 申请微信小程序，配置小程序id及秘钥; 申请用于支付的微信商户平台账号，配置商户号id及商户平台秘钥，并绑定小程序与该商户号; 后端服务在正式环境下需要htt..."}],["meta",{"property":"og:type","content":"article"}],["meta",{"property":"og:locale","content":"zh-CN"}],["meta",{"property":"og:updated_time","content":"2023-04-03T05:56:54.000Z"}],["meta",{"property":"article:author","content":"Hydra"}],["meta",{"property":"article:tag","content":"微信"}],["meta",{"property":"article:tag","content":"支付"}],["meta",{"property":"article:published_time","content":"2020-11-22T00:00:00.000Z"}],["meta",{"property":"article:modified_time","content":"2023-04-03T05:56:54.000Z"}],["script",{"type":"application/ld+json"},"{\\"@context\\":\\"https://schema.org\\",\\"@type\\":\\"Article\\",\\"headline\\":\\"微信小程序支付流程详解\\",\\"image\\":[\\"\\"],\\"datePublished\\":\\"2020-11-22T00:00:00.000Z\\",\\"dateModified\\":\\"2023-04-03T05:56:54.000Z\\",\\"author\\":[{\\"@type\\":\\"Person\\",\\"name\\":\\"Hydra\\"}]}"]]},"headers":[{"level":2,"title":"1、获取用户openId","slug":"_1、获取用户openid","link":"#_1、获取用户openid","children":[]},{"level":2,"title":"2、调用支付统一下单","slug":"_2、调用支付统一下单","link":"#_2、调用支付统一下单","children":[]},{"level":2,"title":"3、二次签名","slug":"_3、二次签名","link":"#_3、二次签名","children":[]},{"level":2,"title":"4、接收支付通知","slug":"_4、接收支付通知","link":"#_4、接收支付通知","children":[]}],"git":{"createdTime":1680501414000,"updatedTime":1680501414000,"contributors":[{"name":"trunks2008","email":"jialegeyou1111@163.com","commits":1}]},"readingTime":{"minutes":5.76,"words":1727},"filePathRelative":"wechat/payment.md","localizedDate":"2020年11月22日","autoDesc":true}');export{e as data};