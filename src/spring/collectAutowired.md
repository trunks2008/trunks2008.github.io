---
title: 没想到吧，Spring中还有一招集合注入的写法
icon: page
order: 8
author: Hydra
date: 2022-11-30
tag:
  - Spring
# 此页面会出现在文章收藏中
star: true
---



<!-- more -->

哈喽大家好啊，我是Hydra。

Spring作为项目中不可缺少的底层框架，提供的最基础的功能就是`bean`的管理了。`bean`的注入相信大家都比较熟悉了，但是有几种不太常用到的集合注入方式，可能有的同学会不太了解，今天我们就通过实例看看它的使用。

首先，声明一个接口：

```java
public interface UserDao {
    String getName();
}
```

然后定义两个类来分别实现这个接口，并通过`@Component`注解把`bean`放入spring容器中：

```java
@Component
public class UserDaoA implements UserDao {
    @Override
    public String getName() {
        return "Hydra";
    }
}
```

```java
@Component
public class UserDaoB implements UserDao {
    @Override
    public String getName() {
        return "#公众号：码农参上";
    }
}
```

准备工作完成后，我们看看几种不同类型的集合注入方式。

## Map注入

首先来看`Map`类型的注入，直接在`Service`中注入一个`Map`，`key`为字符串类型，`value`为上面定义的接口类型。

```java
@Service
@AllArgsConstructor
public class UserMapService {
    final Map<String, UserDao> userDaoMap;

    public Map<String,UserDao> getDaos(){
        return userDaoMap;
    }
}
```

通过接口测试，查看这个`Map`中的内容：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/97f102e5ba3946ffacb34bd893552637~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，`Map`中的`value`是实现了接口的实例对象，`key`则是`beanName`，可以通过`@Component`的`value`属性进行自定义。

修改`UserDaoA`，指定名称：

```java
@Component(value = "Hydra")
public class UserDaoA implements UserDao {...}
```

可以看到，`key`的值发生了改变：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9de76ab920b440c2bc1f934a19948740~tplv-k3u1fbpfcp-zoom-1.image)

## List注入

在`Service`中，这次注入泛型为接口`UserDao`类型的`List`。

```java
@Service
@AllArgsConstructor
public class UserListService {
    private final List<UserDao> userDaoLists;

    public List<UserDao> getDaos(){
        return userDaoLists;
    }
}
```

测试这个方法，查看`List`中的内容，是我们放入容器中的两个`bean`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f5c0a493e208495b9d60b288ffb3d112~tplv-k3u1fbpfcp-zoom-1.image)

我们知道，`List`是一个有序的数据结构，那么如果想要修改`List`中`bean`的排序，该如何做呢？

很简单，修改注入到spring容器中的两个`bean`，为它们添加`@Order`注解并指定加载顺序，数字越小越优先加载。

```java
@Component
@Order(1)
public class UserDaoA implements UserDao {……}
```

```java
@Component
@Order(-1)
public class UserDaoB implements UserDao {……}
```

修改完成后，再进行测试，可以看到`bean`的顺序发生了改变：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3b388cbf073c4084b75d9f45f5d09bb9~tplv-k3u1fbpfcp-zoom-1.image)

## Set注入

同样，也可以使用无序的`Set`注入`bean`，泛型指定为接口类型。

```java
@Service
@AllArgsConstructor
public class UserSetService {
    private final Set<UserDao> userDaoSet;

    public Set<UserDao> getDaos(){
        return userDaoSet;
    }
}
```

查看`Set`中的元素，和`List`相同，只不过顺序变为无序，不会因为`@Order`注解的值而改变：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2d15ffd236704d79889ede2fe7ea232b~tplv-k3u1fbpfcp-zoom-1.image)

## 数组注入

最后，我们再来看一下数组注入的方式：

```java
@Service
@AllArgsConstructor
public class UserArrayService {
    private final  UserDao[] userDaoArray;

    public UserDao[] getDaos(){
        return userDaoArray;
    }
}
```

查看数组中的元素：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/03f4ef0bf8df44bc8c9f274d24c915df~tplv-k3u1fbpfcp-zoom-1.image)

并且，和`List`比较类似的，数组中`bean`的排序会受到`@Order`注解数值的影响，有兴趣的同学可以自己尝试一下。

## 应用

了解了这几种注入方式后，再简单提一下它的使用场景。例如，我们可以用`Map`注入实现策略模式，来替换代码中繁杂的`if/else`判断。例如，原始的代码中判断逻辑可能是这样的：

```java
public String choice(String name){
    if (name.equals("auth")){
        return "Hydra";
    }else if (name.equals("official")){
        return "#公众号：码农参上";
    }    
    return null;
}
```

使用策略模式进行改造，首先修改`beanName`：

```java
@Component(value = "auth")
public class UserDaoA implements UserDao {
    @Override
    public String getName() {
        return "Hydra";
    }
}
```

```java
@Component(value = "official")
public class UserDaoB implements UserDao {
    @Override
    public String getName() {
        return "#公众号：码农参上";
    }
}
```

再修改`Servie`中的方法，一行代码即可实现原有的`if/else`判断：

```java
@Service
@AllArgsConstructor
public class TestService {
    final Map<String, UserDao> userDaoMap;

    public String choice2(String name){
        return userDaoMap.get(name).getName();
    };
}
```

可能在这个例子中，这种写法的优点体现的不十分明显，但是当你有一个非常长的`if/else`判断时，这种模式能使你的代码看上去简洁很多，并且符合代码按照功能拆分的原则。

同理，如果你已经通过`@Order`注解定义好了`bean`的加载顺序，也可以将它理解为`bean`的优先级，例如我想要调用优先级最高的符合类型的`bean`的方法，那么完全可以这样写：

```java
@Service
@AllArgsConstructor
public class TestService {
    final List<UserDao> userDaoLists;
    
    public String choiceFirst(){
        return userDaoLists.get(0).getName();
    };
}
```

通过上面两个简单的例子可以看到，集合注入的方式使用起来非常灵活，我们可以在实际使用中，结合各种设计模式，写出实用而优雅的代码。



