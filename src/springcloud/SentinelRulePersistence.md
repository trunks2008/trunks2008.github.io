---
title: SpringCloud Alibaba Sentinel规则持久化
icon: page
order: 5
author: Hydra
date: 2021-08-27
tag:
  - SpringCloud Alibaba
  - Sentinel
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

在Sentinel使用及规则配置中，介绍了常见的规则配置方式，但是通过 `Sentinel Dashboard`配置的规则是存在内存中的，并且不能推送到本地文件或Nacos中，如果客户端重启那么规则都会丢失。所以需要一种方式，将规则进持久化。

回顾一下，规则的推送存在3种模式，原始模式下规则直接被推送到内存，无法持久化，看一下其余两种模式：

- `Pull`模式：扩展写数据源（`WritableDataSource`），客户端主动向某个规则管理中心定期轮训询拉取规则，这个规则中心可以使RDBMS、文件等
- `Push`模式：扩展读数据源（`ReadalbeDataSource`），规则中心统一推送，客户端通过注册监听器的方式时刻监听变化，比如使用Nacos、Zookeeper等配置中心

下面分别对这两种模式进行扩展说明。

### Pull模式

在Pull模式下，首先 `Sentinel Dashboard`通过api将规则推送至客户端并更新到内存中，接着注册的写数据源会将新的规则保存到本地的文件中。首先添加依赖：

```xml
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-extension</artifactId>
</dependency>
```

参考上篇文章中第二种方式的使用本地文件配置数据源，进行项目的改造。我们需要的就是将规则写回到文件中。分3步看一下原理：

1、`FileRefreshableDataSource`定时从指定文件中读取规则json文件，这里我们读取项目目录下的本地文件，如果发现文件发生变化，就更新规则缓存

```java
ReadableDataSource<String, List<FlowRule>> flowRuleRDS = new FileRefreshableDataSource<>(flowRulePath,flowRuleListParser);
```

2、将可读数据源注册至`FlowRuleManager`，这样当规则文件发生变化时，就会更新规则到内存

```java
FlowRuleManager.register2Property(flowRuleRDS.getProperty());
```

3、将可写数据源注册`WritableDataSourceRegistry`中，这样收到Dashboard推送的规则时，Sentinel会先更新到内存，然后将规则写入到json文件中

```java
WritableDataSource<List<FlowRule>> flowRuleWDS = new FileWritableDataSource<>(     flowRulePath,this::encodeJson);WritableDataSourceRegistry.registerFlowDataSource(flowRuleWDS);
```

完整代码如下：

```java
public class FileDataSourceInit implements InitFunc {
    private Converter<String, List<FlowRule>> flowRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<FlowRule>>() {});
    private Converter<String, List<DegradeRule>> degradeRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<DegradeRule>>() {});
    private Converter<String, List<SystemRule>> systemRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<SystemRule>>() {});
    private Converter<String, List<AuthorityRule>> authorityRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<AuthorityRule>>() {});
    private Converter<String, List<ParamFlowRule>> paramFlowRuleListParser = source -> JSON.parseObject(source,
            new TypeReference<List<ParamFlowRule>>() {});

    @Override
    public void init() throws Exception {
        String prefix = new File("sentinel-persist-file/src/main/resources").getAbsolutePath();
        String ruleDir = prefix+"/rules" ;

        String flowRulePath = ruleDir + "/flowRule.json";
        String degradeRulePath = ruleDir + "/degradeRule.json";
        String systemRulePath = ruleDir + "/systemRule.json";
        String authorityRulePath = ruleDir + "/authorityRule.json";
        String paramFlowRulePath = ruleDir + "/paramFlowRule.json";

        this.mkdirIfNotExits(ruleDir);
        this.createFileIfNotExits(flowRulePath);
        this.createFileIfNotExits(degradeRulePath);
        this.createFileIfNotExits(systemRulePath);
        this.createFileIfNotExits(authorityRulePath);
        this.createFileIfNotExits(paramFlowRulePath);

        // 流控规则
        ReadableDataSource<String, List<FlowRule>> flowRuleRDS = new FileRefreshableDataSource<>(
                flowRulePath,
                flowRuleListParser
        );
        FlowRuleManager.register2Property(flowRuleRDS.getProperty());
        WritableDataSource<List<FlowRule>> flowRuleWDS = new FileWritableDataSource<>(
                flowRulePath,
                this::encodeJson
        );   
        WritableDataSourceRegistry.registerFlowDataSource(flowRuleWDS);

        // 降级规则
        ReadableDataSource<String, List<DegradeRule>> degradeRuleRDS = new FileRefreshableDataSource<>(
                degradeRulePath,
                degradeRuleListParser
        );
        DegradeRuleManager.register2Property(degradeRuleRDS.getProperty());
        WritableDataSource<List<DegradeRule>> degradeRuleWDS = new FileWritableDataSource<>(
                degradeRulePath,
                this::encodeJson
        );
        WritableDataSourceRegistry.registerDegradeDataSource(degradeRuleWDS);

        // 系统规则
        ReadableDataSource<String, List<SystemRule>> systemRuleRDS = new FileRefreshableDataSource<>(
                systemRulePath,
                systemRuleListParser
        );
        SystemRuleManager.register2Property(systemRuleRDS.getProperty());
        WritableDataSource<List<SystemRule>> systemRuleWDS = new FileWritableDataSource<>(
                systemRulePath,
                this::encodeJson
        );
        WritableDataSourceRegistry.registerSystemDataSource(systemRuleWDS);

        // 授权规则
        ReadableDataSource<String, List<AuthorityRule>> authorityRuleRDS = new FileRefreshableDataSource<>(
                authorityRulePath,
                authorityRuleListParser
        );
        AuthorityRuleManager.register2Property(authorityRuleRDS.getProperty());
        WritableDataSource<List<AuthorityRule>> authorityRuleWDS = new FileWritableDataSource<>(
                authorityRulePath,
                this::encodeJson
        );
        WritableDataSourceRegistry.registerAuthorityDataSource(authorityRuleWDS);

        // 热点参数规则
        ReadableDataSource<String, List<ParamFlowRule>> paramFlowRuleRDS = new FileRefreshableDataSource<>(
                paramFlowRulePath,
                paramFlowRuleListParser
        );
        ParamFlowRuleManager.register2Property(paramFlowRuleRDS.getProperty());
        WritableDataSource<List<ParamFlowRule>> paramFlowRuleWDS = new FileWritableDataSource<>(
                paramFlowRulePath,
                this::encodeJson
        );
        ModifyParamFlowRulesCommandHandler.setWritableDataSource(paramFlowRuleWDS);
    }

    private void mkdirIfNotExits(String filePath) throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            file.mkdirs();
        }
    }

    private void createFileIfNotExits(String filePath) throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            file.createNewFile();
        }
    }

    private <T> String encodeJson(T t) {
        return JSON.toJSONString(t);
    }
}
```

项目启动后，会自动创建5个json文件用于存放不同的持久化规则：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b5d7ce71a254775a0901b942c8651b0~tplv-k3u1fbpfcp-zoom-1.image)

添加一条流控规则进行测试：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/10238741acb74fa1acc4950691128196~tplv-k3u1fbpfcp-zoom-1.image)

查看项目目录下的flowRule.json文件：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d8366bf2ba14d0192988058b3609eb3~tplv-k3u1fbpfcp-zoom-1.image)

这样，基于Pull模式的持久化改造就完成了，但是该模式下存在以下缺点：

- 因为是基于定时任务的轮询方式，可能存在间隔时间太长，造成存在延迟的情况
- 规则存储在本地文件中，如果需要项目迁移，需要同时将多个规则文件迁移，否则会出现规则的丢失。

### Push模式

使用Push模式能够在`Sentinel Dashboard`中，将规则推送到nacos或其他远程配置中心。Sentinel客户端链接nacos，获取规则配置，并监听nacos配置变化，如发生变化，就更新本地缓存，从而让本地缓存总是和nacos一致。

使用上篇文章中的使用nacos配置数据源项目进行改造，客户端不需要添加额外依赖。修改`application.yml`配置文件：

```yml
spring:
  cloud:
    sentinel:
      datasource:
        flow:
          nacos:
            server-addr: 127.0.0.1:8848
            group-id: SENTINEL_GROUP
            rule-type: flow
            data-id: ${spring.application.name}-flow-rules
            data-type: json
        degrade:
          nacos:
            server-addr: 127.0.0.1:8848
            group-id: SENTINEL_GROUP
            rule-type: degrade
            data-id: ${spring.application.name}-degrade-rules
            data-type: json
```

这里针对流控和降级分别定义了它们与nacos中规则配置文件的映射关系，通过group-id和data-id指定。

在该模式下，需要对`sentinel dashboard`进行一下改造，使其能向nacos推送规则。这里我采用的方式是下载sentinel 1.8的源码后，将`sentinel-dashboard`的module导入到我们自己的项目中，避免了对整个sentinel项目的过多依赖，方便独立启动。

导入后需要导入一些其原先父pom中的依赖，除此外，还需要修改pom.xml文件：

```xml
<!-- for Nacos rule publisher sample -->
<dependency>
    <groupId>com.alibaba.csp</groupId>
    <artifactId>sentinel-datasource-nacos</artifactId>
    <scope>test</scope>
</dependency>
```

需要将`<scope>`一行注释掉：

```
<!--<scope>test</scope>-->
```

添加nacos-api的依赖：

```xml
<dependency>    
	<groupId>com.alibaba.nacos</groupId>    
	<artifactId>nacos-api</artifactId>    
	<version>1.2.1</version>
</dependency>
```

找到目录：

`/src/test/java/com/alibaba/csp/sentinel/dashboard/rule/nacos`

将整个目录拷贝到 :

`/src/main/java/com/alibaba/csp/sentinel/dashboard/rule/nacos`

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/631e9b8840154d76ac00ef1e3d887d91~tplv-k3u1fbpfcp-zoom-1.image)

这里刚拷过来的时候是没有前两个类的，只有后面4个类，前两个类后面会讲怎么实现。拷贝目录主要是为了使用其中的两个类：

`FlowRuleNacosProvider`：实现了`DynamicRuleProvider`接口，用于从nacos上读取配置

`FlowRuleNacosPublisher`：实现了`DynamicRulePublisher`接口，用于将规则推送到nacos上

修改`NacosConfig`类，这里需要把nacos的地址改为实际地址，注意不同版本的sentinel的源码在这里修改时可能会稍有不同，有的小伙伴如果启动时报错，在地址后面加上nacos的端口号就可以：

```java
@Bean
public ConfigService nacosConfigService() throws Exception {
    return ConfigFactory.createConfigService("localhost");
}
```

修改流控规则`FlowControllerV1`，添加下面代码，使用`@Qualifier`注解注入我们刚才复制来的 Publisher 和 Provider：

```java
@Autowired
@Qualifier("flowRuleNacosProvider")
private DynamicRuleProvider<List<FlowRuleEntity>> ruleProvider;

@Autowired
@Qualifier("flowRuleNacosPublisher")
private DynamicRulePublisher<List<FlowRuleEntity>> rulePublisher;
```

修改`apiQueryMachineRules`方法，使用provider读取规则：

```java
@GetMapping("/rules")
@AuthAction(PrivilegeType.READ_RULE)
public Result<List<FlowRuleEntity>> apiQueryMachineRules(@RequestParam String app) {
    try {
        List<FlowRuleEntity> rules = ruleProvider.getRules(app);
        if (rules != null && !rules.isEmpty()) {
            for (FlowRuleEntity entity : rules) {
                entity.setApp(app);
                if (entity.getClusterConfig() != null && entity.getClusterConfig().getFlowId() != null) {
                    entity.setId(entity.getClusterConfig().getFlowId());
                }
            }
        }
        rules = repository.saveAll(rules);
        return Result.ofSuccess(rules);
    } catch (Throwable throwable) {
        logger.error("Error when querying flow rules", throwable);
        return Result.ofThrowable(-1, throwable);
    }
}
```

修改`publishRules`方法，推送规则到nacos：

```java
private CompletableFuture<Void> publishRules(String app, String ip, Integer port) {
    List<FlowRuleEntity> rules = repository.findAllByMachine(MachineInfo.of(app, ip, port));
    try {
        rulePublisher.publish(app, rules);         
    } catch (Exception e) {
        e.printStackTrace();
    }
    return sentinelApiClient.setFlowRuleOfMachineAsync(app, ip, port, rules);
}
```

到这对流控规则的持久化就完成了，下面进行测试，首先在`Sentinel Dashboard`添加流控规则：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85a9bdb2cda14527833add718954ea1b~tplv-k3u1fbpfcp-zoom-1.image)

查看nacos，已经自动创建了一条对应data-id的流控规则：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c7f3fa9931848169b34bd78b8fd32ca~tplv-k3u1fbpfcp-zoom-1.image)

接下来直接在nacos上修改流控规则，将QPS限制改为30：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b64680d9f57549f5be7413acea756543~tplv-k3u1fbpfcp-zoom-1.image)

刷新`Sentinel Dashboard`，控制台上的显示规则也已经被修改过了：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b5b1baaf03d147cd90efe04e43ec64af~tplv-k3u1fbpfcp-zoom-1.image)

官方test目录下只对流控规则进行了扩展，接下来我们模仿官方的写法对降级规则进行持久化。复制`FlowRuleNacosProvider`，命名为`DegradeRuleNacosProvider`，将其中所有的`FlowRuleEntity改为DegradeRuleEntity`，再更改配置中的data-id，修改完成后如下：

```java
@Component("degradeRuleNacosProvider")
public class DegradeRuleNacosProvider implements DynamicRuleProvider<List<DegradeRuleEntity>> {
    @Autowired
    private ConfigService configService;
    @Autowired
    private Converter<String, List<DegradeRuleEntity>> converter;

    @Override
    public List<DegradeRuleEntity> getRules(String appName) throws Exception {
        String rules = configService.getConfig(appName + NacosConfigUtil.DEGRADE_DATA_ID_POSTFIX,
            NacosConfigUtil.GROUP_ID, 3000);
        if (StringUtil.isEmpty(rules)) {
            return new ArrayList<>();
        }
        return converter.convert(rules);
    }
}
```

同样，复制`FlowRuleNacosPublisher`作为`DegradeRuleNacosPublisher` ，改动方式与上面相同：

```java
@Component("degradeRuleNacosPublisher")
public class DegradeRuleNacosPublisher implements DynamicRulePublisher<List<DegradeRuleEntity>> {

    @Autowired
    private ConfigService configService;
    @Autowired
    private Converter<List<DegradeRuleEntity>, String> converter;

    @Override
    public void publish(String app, List<DegradeRuleEntity> rules) throws Exception {
        AssertUtil.notEmpty(app, "app name cannot be empty");
        if (rules == null) {
            return;
        }
        configService.publishConfig(app + NacosConfigUtil.DEGRADE_DATA_ID_POSTFIX,
            NacosConfigUtil.GROUP_ID, converter.convert(rules));
    }
}
```

修改`DegradeController`，注入创建的`provider和publisher`：

```java
@Autowired
@Qualifier("degradeRuleNacosProvider")
private DynamicRuleProvider<List<DegradeRuleEntity>> provider;

@Autowired
@Qualifier("degradeRuleNacosPublisher")
private DynamicRulePublisher<List<DegradeRuleEntity>> publisher;
```

测试中发现，可以不用修改降级中的`apiQueryMachineRules`方法，只修改`publishRules`方法就可以发布或修改新的规则到nacos：

```java
private boolean publishRules(String app, String ip, Integer port) {
    List<DegradeRuleEntity> rules = repository.findAllByMachine(MachineInfo.of(app, ip, port));
    try {
        publisher.publish(app, rules);        
    } catch (Exception e) {
        e.printStackTrace();        
    }
    return sentinelApiClient.setDegradeRuleOfMachine(app, ip, port, rules);
}
```

以此类推，还可以添加对系统保护、黑白名单以及热点参数的规则持久化，这样对`Sentinel Dashboard`的改造就基本完成了，修改规则时就会被同步到nacos中，并且在重启dashboard、nacos以及业务项目的客户端后，规则仍然存在。相对于Pull模式下的持久化，Push模式具有强一致性，并且拥有更高的性能，但是相应的需要对`Sentinel Dashboard`进行源码的改造，具有一定的复杂性。