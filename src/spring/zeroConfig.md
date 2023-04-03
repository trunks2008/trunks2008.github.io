---
title: Spring Boot零配置启动原理
icon: page
order: 6
author: Hydra
date: 2022-07-05
tag:
  - SpringBoot
  - 配置
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

在创建传统SpringMVC项目时，需要复杂的配置文件，例如：

- `web.xml`，加载配置spring容器，配置拦截
- `application.xml`，配置扫描包，扫描业务类
- `springmvc.xml`，扫描controller，视图解析器等
- ……

而Spring Boot为我们提供了一种极简的项目搭建方式，看一下Spring Boot项目的启动类：

```java
@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class,args);
    }
}
```

简单的一行代码，即可启动一个Spring Boot程序，那么在实际运行中是如何做到零配置启动的呢？下面从源码角度进行分析。

## @SpringBootApplication

首先看一下`@SpringBootApplication`这个组合注解，除去元注解外，它还引入了其他三个重要的注解：

```java
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan
```

### @SpringBootConfiguration

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Configuration
public @interface SpringBootConfiguration {
}
```

从源码可以看到，其实`@SpringBootConfiguration`并没有额外功能，它只是Spring中`@Configuration`的派生注解，用于标注配置类，完成Bean的配置与管理。

### @ComponentScan

Spring中的注解，用于包的扫描，并把声明了特定注解的类交给spring的ioc容器。

### @EnableAutoConfiguration

Spring Boot有中一个非常重要的理念就是约定大于配置。而自动配置这一机制的核心实现就是靠`@EnableAutoConfiguration`注解完成的。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9c3b15e97d74409bb580801e3bad99c0~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，在`@EnableAutoConfiguration`注解中，使用`@Import`导入了`AutoConfigurationImportSelector`这个类，实现了`ImportSelector`接口的`selectImports()`方法。spring中会把`selectImports()`方法返回的String数组中的类的全限定名实例化为bean，并交给spring容器管理。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/64c07d2207024fe194fd4a3b11d8b9af~tplv-k3u1fbpfcp-zoom-1.image)

查看其中的`getAutoConfigurationEntry`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f39e482fcecb4233aad60104ab120ed2~tplv-k3u1fbpfcp-zoom-1.image)

在执行完`getCandidateConfigurations`后，把众多类的全限定名存储到了一个List中。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4f2351e5d334c90b2e28ad15b075959~tplv-k3u1fbpfcp-zoom-1.image)

`SpringFactoriesLoader`这个类非常重要，属于Spring框架的一种扩展方案，提供一种了配置查找的功能支持。其主要功能就是读取配置文件`META-INF/spring.factories`，决定要加载哪些类。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5b53410db2eb4b129e8dbe276719d036~tplv-k3u1fbpfcp-zoom-1.image)

当然，并不是所有`spring.factories`中的类都会被加载到spring容器中，很多情况下需要按照需求所需的情况引入，依赖条件注解`@Conditional`进行判断。例如`ServletWebServerFactoryAutoConfiguration`类

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e60536d30f0c4e85885b6243b7c514b7~tplv-k3u1fbpfcp-zoom-1.image)

只有在`classpath`下存在`ServletRequest`这一类时，才将`ServletWebServerFactoryAutoConfiguration`作为配置类导入spring容器中。

## SpringApplication

`SpringApplication`提供了一个简单的方式以启动Spring boot程序，查看`SpringApplication.run`方法调用。在此创建了一个`SpringApplication`的实例，并调用了它的run方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8f10e2de612d4a43b7406d72fa3724fa~tplv-k3u1fbpfcp-zoom-1.image)

看一下创建实例的过程源码：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4fbd6ff717c64c9fb9a59828786132eb~tplv-k3u1fbpfcp-zoom-1.image)

主要完成了这几件事情：

- 设置资源加载器，用于将资源加载到加载器中
- 判断当前项目类型是什么？ 提供了`NONE`，`SERVLET`，`REACTIVE` 三种类型备选
- 使用`SpringFactoriesLoader`查找并加载所有可用的`ApplicationContextInitializer`
- 使用`SpringFactoriesLoader`查找并加载所有可用的监听器`ApplicationListener`
- 推断并设置`main`方法的定义

`SpringApplication`完成初始化后，调用`run`方法，下面对`run`方法中核心代码进行分析：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1a61b3f6a69e42ed942f82ee2c01c192~tplv-k3u1fbpfcp-zoom-1.image)

按照图中标注序号进行分析：

1、spring监听器的使用，要获取这些监听器的对象，就要知道其全路径。通过`SpringFactoriesLoader`查找`spring.factories`获得，之后再调用它们的`started()`方法

2、 创建并配置当前Spring Boot应用将要使用的Environment，根据监听器和默认应用参数来准备所需要的环境

3、打印Banner

4、创建spring应用上下文。根据之前推断的项目类型，决定该为当前SpringBoot应用创建什么类型的`ApplicationContext`并创建完成

5、准备应用上下文，首先将之前准备好的Environment设置给创建好的`ApplicationContext`使用。然后遍历调用所有`ApplicationContextInitializer`的`initialize`方法来对已经创建好的`ApplicationContext`进行进一步的处理。最后，遍历调用所有`SpringApplicationRunListener`的`contextPrepared()`方法

6、这里最终调用了`Spring中AbstractApplicationContext`的`refresh`方法，可以说这个`refresh`方法是Spring中最重要的方法之一，完成了Bean工厂创建，后置管理器注册，Bean实例化等最重要的工作。这一步工作完成后，spring的ioc容器就完成了

7、如果有Bean实现了`CommandLineRunner`接口并重写了`run`方法，则遍历执行`CommandLineRunner`中的方法

## 手写 Starter

Starter是Spring boot的核心思想之一，在使用spring boot来搭建项目时，往往只需要引入官方提供的starter，就可以直接使用，而不用再进行复杂的配置工作。

一方面，是前面说过的通过动态spi扩展可以直接从starter的`META-INF/spring.factories`中决定什么类将被实例化为bean交给spring容器管理。另一方面，starter的父pom中往往已经包含了需要导入的依赖，以`mybatis-spring-boot-starter`这一starter为例，点开后可以看见它已经将依赖的坐标全部为我们导入了。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2be848e401664232b10b615c8493439e~tplv-k3u1fbpfcp-zoom-1.image)

总的来说，使用starter可以完成以下功能：

- 启用功能，注意不是实现功能 
- 依赖管理，starter帮我们引入需要的所有依赖

讲完了关于starter的原理，下面讲讲如何构造一个自己的starter。官方为我们提供了一个命名规范，建议第三方starter命名应当遵循`thirdpart-spring-boot-starter`这一格式，那我们就来手写一个`my-spring-boot-starter`，通过这个过程来学习如何完成属性的配置。

1、创建一个maven的普通project，在pom中添加parent节点

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.2.6.RELEASE</version>
    <relativePath/>
</parent>
```

2、引入自动装配的依赖

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-autoconfigure</artifactId>
    </dependency>
</dependencies>
```

3、实现自己的功能需求

```java
public class SayhiImpl implements ISayhi {
    @Autowired
    MyProperties properties;
    @Override
    public void welcome() {
        String name=properties.getName();
        System.out.println(name+" hello spring boot");
    }
}
```

如果希望能够在其他项目中使用的时候，通过yml或property文件对这个属性进行赋值，就要写一个对属性进行赋值操作的类，并使用`@ConfigurationProperties`注解

```java
@ConfigurationProperties("spring.sayhi")
public class MyProperties {
    private String name="";
    public String getName() {
        return name;
    }
    public void setName(String name) {
        this.name = name;
    }
}
```

4、如果希望上面开发的功能在springboot启动的时候就加入项目进行管理，就需要有一个代表当前starer自动装配的类

```java
@Configuration
@ConditionalOnClass
//使配置文件生效
@EnableConfigurationProperties(MyProperties.class)
public class MyAutoConfiguration {
    @Bean
    //条件注解，仅当ioc容器中不存在指定类型的bean时，才会创建bean
    @ConditionalOnMissingBean
    public ISayhi sayhi(){
        return new SayhiImpl();
    }
}
```

5、在`resources`创建`META-INF`，创建`spring.factories`文件，在里面写入：

```xml
org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.test.MyAutoConfiguration
```

6、使用maven打包

```shell
mvn clean install
```

### 测试工程

1、新建一个测试工程，在pom文件中引入上面打包的坐标

```xml
<dependency>
    <groupId>com.test</groupId>
    <artifactId>my-spring-boot-starter</artifactId>
    <version>1.0-SNAPSHOT</version>
</dependency>
```

2、使用yml进行属性的配置

```yml
spring:
  sayhi:
    name: hydra
```

3、运行测试

```java
@SpringBootApplication
public class TestApplication implements CommandLineRunner {
    @Autowired
    private ISayhi sayhi;
    public static void main(String[] args) {
        SpringApplication application=new SpringApplication(TestApplication.class);
        application.run(args);
    }
    @Override
    public void run(String... args) throws Exception {
        sayhi.welcome();
    }
}
```

结果：

```
hydra hello spring boot
```

如果在之前为name设置了默认值，那么在不在yml中对name进行配置的话就会打印默认值。这也就是为什么springboot在启动tomcat时会自动为我们设置为8080端口的原因，从这再一次体现了“约定大于配置”这一理念。