---
title: 简化本地Feign调用，老手教你这么玩
icon: page
order: 9
author: Hydra
date: 2023-06-09
tag:
  - Spring Cloud
  - Feign
star: true
---



<!-- more -->

哈喽大家好啊，我是Hydra。

在平常的工作中，`OpenFeign`作为微服务间的调用组件使用的非常普遍，接口配合注解的调用方式突出一个简便，让我们能无需关注内部细节就能实现服务间的接口调用。

但是工作中用久了，发现Feign也有些使用起来麻烦的地方，下面先来看一个问题，再看看我们在工作中是如何解决，以达到简化Feign使用的目的。

## 先看问题

在一个项目开发的过程中，我们通常会区分开发环境、测试环境和生产环境，如果有的项目要求更高的话，可能还会有个预生产环境。

开发环境作为和前端开发联调的环境，一般使用起来都比较随意，而我们在进行本地开发的时候，有时候也会将本地启动的微服务注册到注册中心nacos上，方便进行调试。

这样，注册中心的一个微服务可能就会拥有多个服务实例，就像下面这样：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d4ad0bb960a44c61ac484a7f405429e9~tplv-k3u1fbpfcp-zoom-1.image)

眼尖的小伙伴肯定发现了，这两个实例的ip地址有一点不同。

线上环境现在一般使用容器化部署，通常都是由流水线工具打成镜像然后扔到docker中运行，因此我们去看一下服务在docker容器内的ip：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5e2ab68f265940fcac3cfc516ef50e68~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，这就是注册到nacos上的服务地址之一，而列表中`192`开头的另一个ip，则是我们本地启动的服务的局域网地址。看一下下面这张图，就能对整个流程一目了然了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f69fecbe08644d94941026dfa8256035~tplv-k3u1fbpfcp-zoom-1.image)

总结一下：

*   两个service都是通过宿主机的ip和port，把自己的信息注册到nacos上
*   线上环境的service注册时使用docker内部ip地址
*   本地的service注册时使用本地局域网地址

那么这时候问题就来了，当我本地再启动一个serviceB，通过`FeignClient`来调用serviceA中的接口时，因为Feign本身的负载均衡，就可能把请求负载均衡到两个不同的serviceA实例。

如果这个调用请求被负载均衡到本地serviceA的话，那么没什么问题，两个服务都在同一个`192.168`网段内，可以正常访问。但是如果负载均衡请求到运行在docker内的serviceA的话，那么问题来了，因为网络不通，所以会请求失败：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/acda136f83b54cbe99a660fe92a24b8b~tplv-k3u1fbpfcp-zoom-1.image)

说白了，就是本地的`192.168`和docker内的虚拟网段`172.17`属于纯二层的两个不同网段，不能互访，所以无法直接调用。

那么，如果想在调试时把请求稳定打到本地服务的话，有一个办法，就是指定在`FeignClient`中添加`url`参数，指定调用的地址：

```java
@FeignClient(value = "hydra-service",url = "http://127.0.0.1:8088/")
public interface ClientA {
    @GetMapping("/test/get")
    String get();
}
```

但是这么一来也会带来点问题：

*   代码上线时需要再把注解中的`url`删掉，还要再次修改代码，如果忘了的话会引起线上问题
*   如果测试的`FeignClient`很多的话，每个都需要配置`url`，修改起来很麻烦

那么，有什么办法进行改进呢？为了解决这个问题，我们还是得从Feign的原理说起。

## Feign原理

Feign的实现和工作原理，我以前写过一篇简单的源码分析，大家可以简单花个几分钟先铺垫一下，[Feign核心源码解析](https://mp.weixin.qq.com/s/FTQMCTOrvUMfK82iBf5fgA)。明白了原理，后面理解起来更方便一些。

简单来说，就是项目中加的`@EnableFeignClients`这个注解，实现时有一行很重要的代码：

```java
@Import(FeignClientsRegistrar.class)
```

这个类实现了`ImportBeanDefinitionRegistrar`接口，在这个接口的`registerBeanDefinitions`方法中，可以手动创建`BeanDefinition`并注册，之后spring会根据`BeanDefinition`实例化生成bean，并放入容器中。

Feign就是通过这种方式，扫描添加了`@FeignClient`注解的接口，然后一步步生成代理对象，具体流程可以看一下下面这张图：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/26a423f975094d2fa3aa639c39bd9d5e~tplv-k3u1fbpfcp-zoom-1.image)

后续在请求时，通过代理对象的`FeignInvocationHandler`进行拦截，并根据对应方法进行处理器的分发，完成后续的http请求操作。

## ImportBeanDefinitionRegistrar

上面提到的`ImportBeanDefinitionRegistrar`，在整个创建`FeignClient`的代理过程中非常重要， 所以我们先写一个简单的例子看一下它的用法。先定义一个实体类：

```java
@Data
@AllArgsConstructor
public class User {
    Long id;
    String name;
}
```

通过`BeanDefinitionBuilder`，向这个实体类的构造方法中传入具体值，最后生成一个`BeanDefinition`：

```java
public class MyBeanDefinitionRegistrar
        implements ImportBeanDefinitionRegistrar {
    @Override
    public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata,
                                        BeanDefinitionRegistry registry) {
        BeanDefinitionBuilder builder
                = BeanDefinitionBuilder.genericBeanDefinition(User.class);
        builder.addConstructorArgValue(1L);
        builder.addConstructorArgValue("Hydra");

        AbstractBeanDefinition beanDefinition = builder.getBeanDefinition();
        registry.registerBeanDefinition(User.class.getSimpleName(),beanDefinition);
    }
}
```

`registerBeanDefinitions`方法的具体调用时间是在之后的`ConfigurationClassPostProcessor`执行`postProcessBeanDefinitionRegistry`方法时，而`registerBeanDefinition`方法则会将`BeanDefinition`放进一个map中，后续根据它实例化bean。

在配置类上通过`@Import`将其引入：

```java
@Configuration
@Import(MyBeanDefinitionRegistrar.class)
public class MyConfiguration {
}
```

注入这个`User`测试：

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final User user;

    public void getUser(){
        System.out.println(user.toString());
    }
}
```

结果打印，说明我们通过自定义`BeanDefinition`的方式成功手动创建了一个bean并放入了spring容器中：

```properties
User(id=1, name=Hydra)
```

好了，准备工作铺垫到这结束，下面开始正式的改造工作。

## 改造

到这里先总结一下，我们纠结的点就是本地环境需要`FeignClient`中配置`url`，但线上环境不需要，并且我们又不想来回修改代码。

除了像源码中那样生成动态代理以及拦截方法，官方文档中还给我们提供了一个手动创建FeignClient的方法。

> <https://docs.spring.io/spring-cloud-openfeign/docs/2.2.9.RELEASE/reference/html/#creating-feign-clients-manually>

简单来说，就是我们可以像下面这样，通过Feign的Builder API来手动创建一个Feign客户端。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1f16639613f4623820171e321c34b35~tplv-k3u1fbpfcp-zoom-1.image)

简单看一下，这个过程中还需要配置`Client`、`Encoder`、`Decoder`、`Contract`、`RequestInterceptor`等内容。

*   `Client`：实际http请求的发起者，如果不涉及负载均衡可以使用简单的`Client.Default`，用到负载均衡则可以使用`LoadBalancerFeignClient`，前面也说了，`LoadBalancerFeignClient`中的`delegate`其实使用的也是`Client.Default`
*   `Encoder`和`Decoder`：Feign的编解码器，在spring项目中使用对应的`SpringEncoder`和`ResponseEntityDecoder`，这个过程中我们借用`GsonHttpMessageConverter`作为消息转换器来解析json
*   `RequestInterceptor`：Feign的拦截器，一般业务用途比较多，比如添加修改header信息等，这里用不到可以不配
*   `Contract`：字面意思是合约，它的作用是将我们传入的接口进行解析验证，看注解的使用是否符合规范，然后将关于http的元数据抽取成结果并返回。如果我们使用`RequestMapping`、`PostMapping`、`GetMapping`之类注解的话，那么对应使用的是`SpringMvcContract`

其实这里刚需的就只有`Contract`这一个，其他都是可选的配置项。我们写一个配置类，把这些需要的东西都注入进去：

```java
@Slf4j
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({LocalFeignProperties.class})
@Import({LocalFeignClientRegistrar.class})
@ConditionalOnProperty(value = "feign.local.enable", havingValue = "true")
public class FeignAutoConfiguration {
    static {
        log.info("feign local route started");
    }

    @Bean
    @Primary
    public Contract contract(){
        return new SpringMvcContract();
    }

    @Bean(name = "defaultClient")
    public Client defaultClient(){
        return new Client.Default(null,null);
    }

    @Bean(name = "ribbonClient")
    public Client ribbonClient(CachingSpringLoadBalancerFactory cachingFactory,
                               SpringClientFactory clientFactory){
        return new LoadBalancerFeignClient(defaultClient(), cachingFactory,
                clientFactory);
    }

    @Bean
    public Decoder decoder(){
        HttpMessageConverter httpMessageConverter=new GsonHttpMessageConverter();
        ObjectFactory<HttpMessageConverters> messageConverters= () -> new HttpMessageConverters(httpMessageConverter);
        SpringDecoder springDecoder = new SpringDecoder(messageConverters);
        return new ResponseEntityDecoder(springDecoder);
    }

    @Bean
    public Encoder encoder(){
        HttpMessageConverter httpMessageConverter=new GsonHttpMessageConverter();
        ObjectFactory<HttpMessageConverters> messageConverters= () -> new HttpMessageConverters(httpMessageConverter);
        return new SpringEncoder(messageConverters);
    }
}
```

在这个配置类上，还有三行注解，我们一点点解释。

首先是引入的配置类`LocalFeignProperties`，里面有三个属性，分别是是否开启本地路由的开关、扫描FeignClient接口的包名，以及我们要做的本地路由映射关系，`addressMapping`中存的是服务名和对应的url地址：

```java
@Data
@Component
@ConfigurationProperties(prefix = "feign.local")
public class LocalFeignProperties {
    // 是否开启本地路由
    private String enable;

    //扫描FeignClient的包名
    private String basePackage;

    //路由地址映射
    private Map<String,String> addressMapping;
}
```

下面这行注解则表示只有当配置文件中`feign.local.enable`这个属性为`true`时，才使当前配置文件生效：

```java
@ConditionalOnProperty(value = "feign.local.enable", havingValue = "true")
```

最后，就是我们重中之重的`LocalFeignClientRegistrar`了，我们还是按照官方通过`ImportBeanDefinitionRegistrar`接口构建`BeanDefinition`然后注册的思路来实现。

并且，`FeignClientsRegistrar`的源码中已经实现好了很多基础的功能，比如扫扫描包、获取`FeignClient`的`name`、`contextId`、`url`等等，所以需要改动的地方非常少，可以放心的大抄特超它的代码。

先创建`LocalFeignClientRegistrar`，并注入需要用到的`ResourceLoader`、`BeanFactory`、`Environment`。

```java
@Slf4j
public class LocalFeignClientRegistrar implements
        ImportBeanDefinitionRegistrar, ResourceLoaderAware,
        EnvironmentAware, BeanFactoryAware{

    private ResourceLoader resourceLoader;
    private BeanFactory beanFactory;
    private Environment environment;

    @Override
    public void setResourceLoader(ResourceLoader resourceLoader) {
        this.resourceLoader=resourceLoader;
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        this.beanFactory = beanFactory;
    }

    @Override
    public void setEnvironment(Environment environment) {
        this.environment=environment;
    }
	
	//先省略具体功能代码...
}
```

然后看一下创建`BeanDefinition`前的工作，这一部分主要完成了包的扫描和检测`@FeignClient`注解是否被添加在接口上的测试。下面这段代码基本上是照搬源码，除了改动一下扫描包的路径，使用我们自己在配置文件中配置的包名。

```java
@Override
public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
    ClassPathScanningCandidateComponentProvider scanner = ComponentScanner.getScanner(environment);
    scanner.setResourceLoader(resourceLoader);
    AnnotationTypeFilter annotationTypeFilter = new AnnotationTypeFilter(FeignClient.class);
    scanner.addIncludeFilter(annotationTypeFilter);

    String basePackage =environment.getProperty("feign.local.basePackage");
    log.info("begin to scan {}",basePackage);

    Set<BeanDefinition> candidateComponents = scanner.findCandidateComponents(basePackage);

    for (BeanDefinition candidateComponent : candidateComponents) {
        if (candidateComponent instanceof AnnotatedBeanDefinition) {
            log.info(candidateComponent.getBeanClassName());

            // verify annotated class is an interface
            AnnotatedBeanDefinition beanDefinition = (AnnotatedBeanDefinition) candidateComponent;
            AnnotationMetadata annotationMetadata = beanDefinition.getMetadata();
            Assert.isTrue(annotationMetadata.isInterface(),
                    "@FeignClient can only be specified on an interface");

            Map<String, Object> attributes = annotationMetadata
                    .getAnnotationAttributes(FeignClient.class.getCanonicalName());

            String name = FeignCommonUtil.getClientName(attributes);
            registerFeignClient(registry, annotationMetadata, attributes);
        }
    }
}
```

接下来创建`BeanDefinition`并注册，Feign的源码中是使用的`FeignClientFactoryBean`创建代理对象，这里我们就不需要了，直接替换成使用`Feign.builder`创建。

```java
private void registerFeignClient(BeanDefinitionRegistry registry,
                                 AnnotationMetadata annotationMetadata, Map<String, Object> attributes) {
    String className = annotationMetadata.getClassName();
    Class clazz = ClassUtils.resolveClassName(className, null);
    ConfigurableBeanFactory beanFactory = registry instanceof ConfigurableBeanFactory
            ? (ConfigurableBeanFactory) registry : null;
    String contextId = FeignCommonUtil.getContextId(beanFactory, attributes,environment);
    String name = FeignCommonUtil.getName(attributes,environment);

    BeanDefinitionBuilder definition = BeanDefinitionBuilder
            .genericBeanDefinition(clazz, () -> {
                Contract contract = beanFactory.getBean(Contract.class);
                Client defaultClient = (Client) beanFactory.getBean("defaultClient");
                Client ribbonClient = (Client) beanFactory.getBean("ribbonClient");
                Encoder encoder = beanFactory.getBean(Encoder.class);
                Decoder decoder = beanFactory.getBean(Decoder.class);

                LocalFeignProperties properties = beanFactory.getBean(LocalFeignProperties.class);
                Map<String, String> addressMapping = properties.getAddressMapping();

                Feign.Builder builder = Feign.builder()
                        .encoder(encoder)
                        .decoder(decoder)
                        .contract(contract);

                String serviceUrl = addressMapping.get(name);
                String originUrl = FeignCommonUtil.getUrl(beanFactory, attributes, environment);

                Object target;
                if (StringUtils.hasText(serviceUrl)){
                    target = builder.client(defaultClient)
                            .target(clazz, serviceUrl);
                }else if (StringUtils.hasText(originUrl)){
                    target = builder.client(defaultClient)
                            .target(clazz,originUrl);
                }else {
                    target = builder.client(ribbonClient)
                            .target(clazz,"http://"+name);
                }

                return target;
            });

    definition.setAutowireMode(AbstractBeanDefinition.AUTOWIRE_BY_TYPE);
    definition.setLazyInit(true);
    FeignCommonUtil.validate(attributes);

    AbstractBeanDefinition beanDefinition = definition.getBeanDefinition();
    beanDefinition.setAttribute(FactoryBean.OBJECT_TYPE_ATTRIBUTE, className);

    // has a default, won't be null
    boolean primary = (Boolean) attributes.get("primary");
    beanDefinition.setPrimary(primary);

    String[] qualifiers = FeignCommonUtil.getQualifiers(attributes);
    if (ObjectUtils.isEmpty(qualifiers)) {
        qualifiers = new String[] { contextId + "FeignClient" };
    }

    BeanDefinitionHolder holder = new BeanDefinitionHolder(beanDefinition, className,
            qualifiers);
    BeanDefinitionReaderUtils.registerBeanDefinition(holder, registry);
}
```

在这个过程中主要做了这么几件事：

*   通过`beanFactory`拿到了我们在前面创建的`Client`、`Encoder`、`Decoder`、`Contract`，用来构建`Feign.Builder`
*   通过注入配置类，通过`addressMapping`拿到配置文件中服务对应的调用`url`
*   通过`target`方法替换要请求的`url`，如果配置文件中存在则优先使用配置文件中`url`，否则使用`@FeignClient`注解中配置的`url`，如果都没有则使用服务名通过`LoadBalancerFeignClient`访问

在`resources/META-INF`目录下创建`spring.factories`文件，通过spi注册我们的自动配置类：

```properties
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
  com.feign.local.config.FeignAutoConfiguration
```

最后，本地打包即可：

```shell
mvn clean install
```

## 测试

引入我们在上面打好的包，由于包中已经包含了`spring-cloud-starter-openfeign`，所以就不需要再额外引`feign`的包了：

```xml
<dependency>
    <groupId>com.cn.hydra</groupId>
    <artifactId>feign-local-enhancer</artifactId>
    <version>1.0-SNAPSHOT</version>
</dependency>
```

在配置文件中添加配置信息，启用组件：

```yml
feign:
  local:
    enable: true
    basePackage: com.service
    addressMapping:
      hydra-service: http://127.0.0.1:8088
      trunks-service: http://127.0.0.1:8099
```

创建一个`FeignClient`接口，注解的`url`中我们可以随便写一个地址，可以用来测试之后是否会被配置文件中的服务地址覆盖：

```java
@FeignClient(value = "hydra-service",
	contextId = "hydra-serviceA",
	url = "http://127.0.0.1:8099/")
public interface ClientA {
    @GetMapping("/test/get")
    String get();

    @GetMapping("/test/user")
    User getUser();
}
```

启动服务，过程中可以看见了执行扫描包的操作：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0dcd508e4144f23b56a06f876c451cd~tplv-k3u1fbpfcp-zoom-1.image)

在替换`url`过程中添加一个断点，可以看到即使在注解中配置了`url`，也会优先被配置文件中的服务`url`覆盖：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82f1fa4f20dc4aecb3492330a802503c~tplv-k3u1fbpfcp-zoom-1.image)

使用接口进行测试，可以看到使用上面的代理对象进行了访问并成功返回了结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b4a7245da0474346a110668b1a0ad811~tplv-k3u1fbpfcp-zoom-1.image)

如果项目需要发布正式环境，只需要将配置`feign.local.enable`改为`false`或删掉，并在项目中添加Feign原始的`@EnableFeignClients`即可。

## 总结

本文提供了一个在本地开发过程中简化Feign调用的思路，相比之前需要麻烦的修改`FeignClient`中的`url`而言，能够节省不少的无效劳动，并且通过这个过程，也可以帮助大家了解我们平常使用的这些组件是怎么与spring结合在一起的，熟悉spring的扩展点。

组件代码已提交到我的github，有需要的小伙伴们可以自取，码字不易，也欢迎大家点个star\~

> <https://github.com/trunks2008/feign-local-enhancer>

那么，这次的分享就到这里，我是Hydra，我们下篇再见。


