---
title: Sentinel使用及规则配置
icon: page
order: 4
author: Hydra
date: 2021-08-26
tag:
  - SpringCLoud Alibaba
  - Sentinel
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

`Sentinel`是`SpringCloud Alibaba`提供的微服务组件，能够从流量控制、熔断降级、系统负载保护等多个维度保护服务的稳定性。与`Hystrix`相比，`Sentinel`拥有更多的熔断降级维度，更加轻量灵活，并且由于`Hystrix`已经停止维护，在生产环境中`Sentinel`已经被广泛应用。作为`Sentinel`的基础使用，本篇来看一下应该如何进行规则配置。

首先在pom中引入核心依赖：

```xml
<dependency>
    <groupId>com.alibaba.cloud</groupId>
    <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
</dependency>
```

在Service中，基于注解的方式定义降级方法和抛出异常时的方法：

```java
@Service
public class QueryService {
    private static final String KEY="query";
    
    @SentinelResource(value = KEY,blockHandler ="blockHandlerMethod",
            fallback = "fallbackMethod")
    public String query(String name) {
        if(name.equals("3")){
            throw new RuntimeException("3 error");
        }
        return "begin query method, name= " + name;
    }
    
    public String blockHandlerMethod(String name, BlockException e){
        e.printStackTrace();
        return "blockHandlerMethod for Query : " + name;
    }

    public String fallbackMethod(String name, Throwable e){
        e.printStackTrace();
        return "fallbackMethod for Query : " + name;
    }
}
```

在上面的示例中，通过`@SentinelResource`注解的`blockHandler`属性指定降级方法，通过`fallback`属性指定抛出异常时方法。下面，介绍3种规则的定义方式。

### 1、直接编码方式

首先定义一个配置类，用于加载规则。在`Sentinel`中，可以定制5种规则：

- 流量控制规则 `FlowRule`
- 熔断降级规则 `DegradeRule`
- 访问控制规则 `AuthorityRule`
- 系统保护规则 `SystemRule`
- 热点规则 `ParamFlowRule`

```java
@Component
public class SentinelConfig {
    private static final String KEY="query";
    @PostConstruct
    private void init(){
        initDegradeRule();
        initFlowQpsRule();
        initSystemRule();
        initAuthorityRule();
        initParamFlowRule();
    }

    //熔断降级规则
    private void initDegradeRule(){
        List<DegradeRule> rules=new ArrayList<>();
        DegradeRule rule=new DegradeRule();
        rule.setResource(KEY);
        // 80s内调用接口出现 异常 ,次数超过5的时候, 进行熔断
        rule.setCount(5);
        rule.setGrade(RuleConstant.DEGRADE_GRADE_EXCEPTION_COUNT);
        rule.setTimeWindow(80);
        rules.add(rule);
        DegradeRuleManager.loadRules(rules);
    }

    //流量控制规则
    private void initFlowQpsRule() {
        List<FlowRule> rules = new ArrayList<>();
        FlowRule rule = new FlowRule(KEY);
        rule.setCount(20);
        rule.setGrade(RuleConstant.FLOW_GRADE_QPS);
        rule.setLimitApp("default");
        rules.add(rule);
        FlowRuleManager.loadRules(rules);
    }

    //系统保护规则
    private void initSystemRule() {
        List<SystemRule> rules = new ArrayList<>();
        SystemRule rule = new SystemRule();
        rule.setHighestSystemLoad(10);
        rules.add(rule);
        SystemRuleManager.loadRules(rules);
    }

    //黑白名单控制
    private void initAuthorityRule(){
        List<AuthorityRule> rules=new ArrayList<>();

        AuthorityRule rule = new AuthorityRule();
        rule.setResource(KEY);
        rule.setStrategy(RuleConstant.AUTHORITY_BLACK);
        rule.setLimitApp("nacos-consumer");
        rules.add(rule);
        AuthorityRuleManager.loadRules(rules);
    }

    //热点参数规则
    private void initParamFlowRule(){
        ParamFlowRule rule = new ParamFlowRule(KEY)
                .setParamIdx(0)
                .setCount(20);    
        ParamFlowItem item = new ParamFlowItem().setObject(String.valueOf("4"))
                .setClassType(String.class.getName())
                .setCount(2);
        rule.setParamFlowItemList(Collections.singletonList(item));
        ParamFlowRuleManager.loadRules(Collections.singletonList(rule));
    }
}
```

在yml中配置`sentinel-dashboard`的地址：

```yml
spring:
  cloud:
    sentinel:
      transport:
        port: 8719 
        dashboard: localhost:8088 #sentinel控制台地址  
```

启动`sentinel-dashboard`：

```cmd
java -Dserver.port=8088 -jar sentinel-dashboard-1.8.0.jar
```

通过调用接口，可以在dashboard的web页面监控到接口的调用情况：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a8827adf37cd458ba481796ca0897cf2~tplv-k3u1fbpfcp-zoom-1.image)

查看流控规则，在QPS为2时触发快速失败：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80064735c1194629b04eabdbc26707a9~tplv-k3u1fbpfcp-zoom-1.image)

查看降级规则，当异常次数超过5次后进行熔断：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a076e85289084c7eb1742a2c382bddef~tplv-k3u1fbpfcp-zoom-1.image)



### 2、使用本地文件配置数据源

`Sentinel`支持多种不同的数据源来配置规则，目前包括以下几种方式：

- 文件配置
- Nacos配置
- ZooKeeper配置
- Apollo配置

在一些情况下，如果配置规则不需要存储在nacos等其他组件上，并且规则不常改变，我们可以把配置规则保存在本地的配置文件中。

创建类`FileDataSourceInit`，用于读取配置文件：

```java
public class FileDataSourceInit implements InitFunc {
    private Converter<String, List<FlowRule>> flowRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<FlowRule>>() {});
    private Converter<String, List<DegradeRule>> degradeRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<DegradeRule>>() {});
    private Converter<String, List<SystemRule>> systemRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<SystemRule>>() {});
    private Converter<String, List<ParamFlowRule>> paramFlowRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<ParamFlowRule>>() {});
    private Converter<String, List<AuthorityRule>> authorityRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<AuthorityRule>>() {});

    @Override
    public void init() throws Exception {
        ClassLoader classLoader = getClass().getClassLoader();
        String flowRulePath = URLDecoder.decode(classLoader.getResource("rules/flowRule.json").getFile(), "UTF-8");
        String degradeRulePath = URLDecoder.decode(classLoader.getResource("rules/degradeRule.json").getFile(), "UTF-8");
        String systemRulePath = URLDecoder.decode(classLoader.getResource("rules/systemRule.json").getFile(), "UTF-8");
        String paramFlowRulePath = URLDecoder.decode(classLoader.getResource("rules/paramFlowRule.json").getFile(), "UTF-8");
        String authorityRulePath = URLDecoder.decode(classLoader.getResource("rules/authorityRule.json").getFile(), "UTF-8");

        // Data source for FlowRule
        FileRefreshableDataSource<List<FlowRule>> flowRuleDataSource = new FileRefreshableDataSource<>(
                flowRulePath, flowRuleListParser);
        FlowRuleManager.register2Property(flowRuleDataSource.getProperty());

        // Data source for DegradeRule
        FileRefreshableDataSource<List<DegradeRule>> degradeRuleDataSource
                = new FileRefreshableDataSource<>(
                degradeRulePath, degradeRuleListParser);
        DegradeRuleManager.register2Property(degradeRuleDataSource.getProperty());

        // Data source for SystemRule
        FileRefreshableDataSource<List<SystemRule>> systemRuleDataSource
                = new FileRefreshableDataSource<>(
                systemRulePath, systemRuleListParser);
        SystemRuleManager.register2Property(systemRuleDataSource.getProperty());

        // Data source for ParamFlowRule
        FileRefreshableDataSource<List<ParamFlowRule>> paramFlowRuleDataSource
                = new FileRefreshableDataSource<>(
                paramFlowRulePath, paramFlowRuleListParser);
        ParamFlowRuleManager.register2Property(paramFlowRuleDataSource.getProperty());

        // Data source for AuthorityRule
        FileRefreshableDataSource<List<AuthorityRule>> authorityRuleDataSource
                = new FileRefreshableDataSource<>(
                authorityRulePath, authorityRuleListParser);
        AuthorityRuleManager.register2Property(authorityRuleDataSource.getProperty());
    }
}
```

基于SPI扩展机制，在`resources`下创建`META-INF/services`目录，创建文件`com.alibaba.csp.sentinel.init.InitFunc`，里面填写上面类的全限定名：

```properties
com.cn.config.FileDataSourceInit
```

在`resources`下创建`rules`目录，存放配置规则的json文件，以`flowRule.json`为例，配置格式如下：

```json
[
  {
    "resource":"query",
    "limitApp":"default",
    "grade":"1",
    "count":"2",
    "strategy":0,
    "controlBehavior":2,
    "clusterMode":false
  }
]
```

上面是一个json数组，数组中的每个对象是针对每一个保护资源的配置对象。解释一下上面各参数的意义：

```properties
resource：资源名称
limitApp：来源应用
grade：阈值类型，0表示线程数，1表示QPS
count：单机阈值
strategy：流控模式，0表示直接，1表示关联，2表示链路
controlBehavior：流控效果，0表示快速失败，1表示warm up，2表示排队等待
clusterMode：是否集群
```

其他的规则参数可以参考第一种方式中各Rule的源码中的属性，将首字母变为小写即对应json中的属性名。这样，通过SPI扩展机制就能够将配置文件中的规则加载到内存中了。

### 3、使用nacos配置数据源

阅读官方文档时发现，官方推荐了使用nacos作为数据源，需要导入nacos存储扩展的依赖：

```xml
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-nacos</artifactId>
    <version>1.8.0</version>
</dependency>
```

在yml中添加配置信息，配置nacos作为数据源：

```yml
spring:
  cloud:
    sentinel:
      transport:
        port: 8719  
        dashboard: localhost:8088 
      datasource:
        ds:
          nacos:
            server-addr: 127.0.0.1:8848 
            group-id: DEFAULT_GROUP
            rule-type: flow 
            data-id: sentinel-demo-getSentinelConfig
            data-type: json
```

数据源参数意义：

```
ds：数据源名，可随意配置
server-addr： nacos连接地址
group-id: nacos连接的分组
rule-type: 指定路由存储规则
data-id: 读取配置文件的 data-id
data-type: 指定读取配置文件的类型
```

在nacos的配置列表中添加一条流控规则的配置信息：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/35e71bc93aac49a7bca7f228078fe52d~tplv-k3u1fbpfcp-zoom-1.image)

与项目的`application.yml`中对应，`data-id`为`sentinel-demo-getSentinelConfig`，`group-id`为`DEFAULT_GROUP`。

刷新dashboard的流控页面，可以看见新建的规则已经被推送过来：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2f55a3c9f1714bc48a6a58bdf92d32de~tplv-k3u1fbpfcp-zoom-1.image)

如果修改nacos中配置文件的内容，规则会被推送到dashboard中，并且内存中的规则也会随之更新。这样相对于前面的两种配置方式，就实现了不停机更新规则。并且在完成了上面的整合之后，对于规则的修改就可以在`Sentinel-dashboard`、`nacos`两个地方同时进行修改了。

但是这样仍然存在一些问题，需要注意：

- 通过dashboard设置的规则是存在于内存中的，一旦重启规则就会消失
- 只能通过nacos向dashboard传递规则，而不能将规则写到nacos或本地配置文件中，即规则的传递是单向的

回顾一下前面的内容，既然nacos或配置文件中的规则是持续存在而不是存在于内存中的，那么是否可以将dashboard中配置的规则存储起来呢。下一篇，我们来讲讲如何将规则进行持久化。