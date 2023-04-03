---
title: MyBatis 执行流程及源码解析
icon: page
order: 1
author: Hydra
date: 2021-10-13
tag:
  - MyBatis
  - 源码解析
# 此页面会在文章列表置顶
sticky: false
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

我们在日常工作中广泛使用mybatis作为数据持久层框架，但是mybatis的执行流程是怎么样的，你了解过吗。本文将从源码角度，带你分析mybatis的工作原理。


先看一个简单的例子，以Service调用Mapper接口为，先写一个简单的Mapper：

```java
public interface StudentMapper {
    @Select("select * from student")
    public List<Map<String,Object>> query();
}
```

在Servie中调用Mapper的方法：

```java
@Service("studentService")
public class StudentServiceImpl implements StudentService {
    @Autowired
    StudentMapper studentMapper;

    @Override
    public List<Map<String, Object>> query() {
        return studentMapper.select();
    }
}
```

向Service中注入这个Mapper并调用时，你知道这时注入的是什么吗？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c43792018c694f83907f08df9c40dbcd~tplv-k3u1fbpfcp-zoom-1.image)

通过调试，可以知道这时实际的studentMapper是一个类型为`MapperProxy`的代理对象，下面将从myabtis环境初始化开始，具体分析代理对象的产生过程。

### 一、配置SqlSessionFactoryBean 时都做了什么？

在进行spring和mybatis整合时，会用xml或者注解的方式去配置一个`SqlSessionFactoryBean`，本文中以注解方式为例：

```java
@Bean
public SqlSessionFactoryBean sqlSessionFactoryBean(DataSource dataSource){
   SqlSessionFactoryBean sqlSessionFactoryBean=new SqlSessionFactoryBean();
   sqlSessionFactoryBean.setDataSource(dataSource);
   return  sqlSessionFactoryBean;
}
```

看一下`SqlSessionFactoryBean`的继承实现关系：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/276dbb2054d642fea358b61582abb502~tplv-k3u1fbpfcp-zoom-1.image)

先铺垫一下spring中两个非常重要的接口，`FactoryBean`和`InitializingBean`。

**FactoryBean：**

`FactoryBean`是一个spring中比较特殊的Bean，通过它的`getObject()`方法可以返回一个对象实例。`SqlSessionFactoryBean`中`getObject()`方法的实现：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/90f10342bef043958d5a5e1f97c203e7~tplv-k3u1fbpfcp-zoom-1.image)

在这里用于创建并返回一个`SqlSessionFactory`，在 spring +mybatis 的环境下，我们使用`SqlSessionFactoryBean`来充当`SqlSessionFactory`。

**InitializingBean：**

`InitializingBean`接口中只有一个方法，`afterPropertiesSet()`，所有实现了该接口的类，在bean的初始化之前都要调用这个方法。可以看出在上面的`getObject`方法中，如果`SqlSessionFactory`为空，会调用这个方法创建`SqlSessionFactory`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d23861fcd7d04180b869006e937b287c~tplv-k3u1fbpfcp-zoom-1.image)

通过调用`SqlSessionFactoryBuilder`的`build`方法，最终返回了一个`DefaultSqlSessionFactory`实例，这个`DefaultSqlSessionFactory`中保存了一个非常重要的`Configuration`对象。

### 二、@MapperScan都做了什么？

在注解配置mybatis时，通过`@MapperScan`指定Mapper存放的包，就能自动为我们把接口实现成类。那么这是怎么实现的呢？

点开`@MapperScan`的源码，发现上面还有一行非常重要的注解：

```java
@Import(MapperScannerRegistrar.class)
```

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ff40e87d3d6b4584aacfa8b4543dd175~tplv-k3u1fbpfcp-zoom-1.image)

`ImportBeanDefinitionRegistrar`接口提供`registerBeanDefinitions`方法向用户暴露了`BeanDefinitionRegistry`，也就是说可以让用户手动创建`BeanDefinition`并使用该注册器注册到spring容器中。

查看`MappercannerRegistrar`的方法`registerBeanDefinitions`中的核心代码：

```java
ClassPathMapperScanner scanner = new ClassPathMapperScanner(registry);
……
scanner.doScan(StringUtils.toStringArray(basePackages));
```

主要是创建了一个Mapper扫描器，开启扫描。看看`ClassPathMapperScanner`中`doScan`方法：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e50d2dda3a0427bb7f39c8658ff4ca9~tplv-k3u1fbpfcp-zoom-1.image)

这里对生成的mapper的bean定义做了进一步处理。进入`processBeanDefinitions()`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/99d0d6a347574f5db9bdac7b99723e16~tplv-k3u1fbpfcp-zoom-1.image)

注意画框代码及上方的注释，先看一下从`BeanDefinitionHolder`获得`BeanDefinition时beanClass`初始的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cfdcf186c5304614be6024d0b6d18290~tplv-k3u1fbpfcp-zoom-1.image)

等待`setBeanClass`执行完毕：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0e341eafe76d486e825f67f5946e9de8~tplv-k3u1fbpfcp-zoom-1.image)

通过`definition.setBeanClass()`把原来的BeanClass的类型替换成了`MapperFactoryBean`类型。到这，完成了Mapper接口加载定义阶段中非常重要的一步，而这也是生成代理对象`MapperProxy`的关键。

### 三、mybatis如何生成代理对象？

看一下`MapperFactoryBean`的继承关系：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7637d2a77c264a4cad70f8c0f33eb656~tplv-k3u1fbpfcp-zoom-1.image)

`MapperFactoryBean`继承的`SqlSessionDaoSupport`类实现了`InitializingBean`接口，那么我们还是首先找`afterPropertiesSet()`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/75d3bf5051e141f8b29bb48f35bb27b9~tplv-k3u1fbpfcp-zoom-1.image)

`DaoSupport`中，最终调用`MapperFactoryBea`n中的方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/73c30aa2b29d46bfae2a25b73ca41d04~tplv-k3u1fbpfcp-zoom-1.image)

首先通过获取`sqlSession`获得了非常重要的配置类`Configuration`，然后查看一下`addMapper`方法，最终调用的是`MapperRegistry`的`addMapper`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a972b1ea2a5e401eb70885fdf110cd8c~tplv-k3u1fbpfcp-zoom-1.image)

红框中的代码为我们创建了Mapper 的代理工厂对象（还不是Mapper的代理对象），并把它放入了`knownMappers`这个Map中。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57bcd545c10b4411bcb6b8b7265e16a6~tplv-k3u1fbpfcp-zoom-1.image)

在这一步，只是简单初始化了`MapperProxyFactory`，把我们自己的mapper的类型传给了它，还并没有真正产生代理对象。

`MapperRegistry`并在之后的`parse()`方法中完成了xml文件的解析，每一个sql方法都被解析成了一个`MappedStatement`对象，并添加到了配置类`Configuration`对象中。

**MapperFactoryBean最终返回了什么？**

因为`MapperFactoryBean`实现了`FactoryBean`接口，所以我们看看`getObject`方法究竟返回了什么：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47ed191a65134346b5de2360d6a88f26~tplv-k3u1fbpfcp-zoom-1.image)

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5f75a08ed5dc4ceebc57a6e0485e6c0f~tplv-k3u1fbpfcp-zoom-1.image)

最终调用`MapperRegistry的getMapper`方法：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/82dd21201a8241eaa3489e0950b8b765~tplv-k3u1fbpfcp-zoom-1.image)

这里调用的了mybatis刚才生成的`MapperProxyFactory`，帮助我们实例化并返回了一个代理对象。

`MapperProxyFactory`中使用`newInstance`方法，实例化`MapperProxy`，用于生成代理：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/443c672acdc74be2b216ad6077ab11ba~tplv-k3u1fbpfcp-zoom-1.image)

至此，我们已经弄明白了文章开头的`MapperProxy`是如何生成的。

### 四、MapperProxy代理对象如何执行sql语句？

在StudentServiceImpl中的query方法中打一个断点跟踪语句，你会发现实际执行的就是代理类`MapperProxy`中的`invoke()`方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9b6c9d4f84714ff2b95f2dfe143b22fe~tplv-k3u1fbpfcp-zoom-1.image)

`MapperProxy`在作为代理类的同时，自身实现了`InvocationHandler`接口，所以`invoke`方法就是真正执行的代理逻辑。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b266543370284d61ba3bf2b664d01c36~tplv-k3u1fbpfcp-zoom-1.image)

在这里最终调用了`MapperMethod`的`execute`方法实际去执行了sql语句。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e40bcff1ce174d97822e748b873d70df~tplv-k3u1fbpfcp-zoom-1.image)

在该方法中，根据sql语句执行类型，调用`sqlSession`对应的方法执行并将结果返回给用户。至此，mybatis在spring环境下一次调用全部完成。