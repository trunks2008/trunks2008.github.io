---
title: 泛型的类型擦除后，fastjson反序列化时如何还原？
icon: page
order: 6
author: Hydra
date: 2021-05-17
tag:
  - 泛型
  - fastjson
star: true
---



<!-- more -->

哈喽大家好啊，我是Hydra~ 在前面的文章中，我们讲过Java中泛型的类型擦除，不过有小伙伴在后台留言提出了一个问题，带有泛型的实体的反序列化过程是如何实现的，今天我们就来看看这个问题。

## 铺垫

我们选择`fastjson`来进行反序列化的测试，在测试前先定义一个实体类：

```java
@Data
public class Foo<T> {
    private String val;
    private T obj;
}
```

如果大家对泛型的类型擦除比较熟悉的话，就会知道在编译完成后，其实在类中是没有泛型的。我们还是用`Jad`反编译一下字节码文件，可以看到没有类型限制的`T`会被直接替换为`Object`类型：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9f7e829790b243eabfdf2e628e7e50cd~tplv-k3u1fbpfcp-zoom-1.image)

下面使用`fastjson`进行反序列化，先不指定`Foo`中泛型的类型：

```java
public static void main(String[] args) {
    String jsonStr = "{\"obj\":{\"name\":\"Hydra\",\"age\":\"18\"},\"val\":\"str\"}";
    Foo<?> foo = JSONObject.parseObject(jsonStr, Foo.class);
    System.out.println(foo.toString());
    System.out.println(foo.getObj().getClass());
}
```

查看执行结果，很明显`fastjson`不知道要把`obj`里的内容反序列化成我们自定义的`User`类型，于是将它解析成了`JSONObject`类型的对象。

```properties
Foo(val=str, obj={"name":"Hydra","age":"18"})
class com.alibaba.fastjson.JSONObject
```

那么，如果想把`obj`的内容映射为`User`实体对象应该怎么写呢？下面先来示范几种错误写法。

### 错误写法1

尝试在反序列化时，直接指定`Foo`中的泛型为`User`：

```java
Foo<User> foo = JSONObject.parseObject(jsonStr, Foo.class);
System.out.println(foo.toString());
System.out.println(foo.getObj().getClass());
```

结果会报类型转换的错误，`JSONObject`不能转成我们自定义的`User`：

```
Exception in thread "main" java.lang.ClassCastException: com.alibaba.fastjson.JSONObject cannot be cast to com.hydra.json.model.User
	at com.hydra.json.generic.Test1.main(Test1.java:24)
```

### 错误写法2

再试试使用强制类型转换：

```java
Foo<?> foo =(Foo<User>) JSONObject.parseObject(jsonStr, Foo.class);
System.out.println(foo.toString());
System.out.println(foo.getObj().getClass());
```

执行结果如下，可以看到，泛型的强制类型转换虽然不会报错，但是同样也没有生效。

```properties
Foo(val=str, obj={"name":"Hydra","age":"18"})
class com.alibaba.fastjson.JSONObject
```

好了，现在请大家忘记上面这两种错误的使用方法，代码中千万别这么写，下面我们看正确的写法。

### 正确写法

在使用`fastjson`时，可以借助`TypeReference`完成指定泛型的反序列化：

```java
public class TypeRefTest {
    public static void main(String[] args) {
        String jsonStr = "{\"obj\":{\"name\":\"Hydra\",\"age\":\"18\"},\"val\":\"str\"}";
        Foo foo2 = JSONObject.parseObject(jsonStr, new TypeReference<Foo<User>>(){});
        System.out.println(foo2.toString());
        System.out.println(foo2.getObj().getClass());
    }
}
```

运行结果：

```properties
Foo(val=str, obj=User(name=Hydra, age=18))
class com.hydra.json.model.User
```

`Foo`中的`obj`类型为`User`，符合我们的预期。下面我们就看看，`fastjson`是如何借助`TypeReference`完成的泛型类型擦除后的还原。

## TypeReference

回头再看一眼上面的代码中的这句：

```java
Foo foo2 = JSONObject.parseObject(jsonStr, new TypeReference<Foo<User>>(){});
```

重点是`parseObject`方法中的第二个参数，注意在`TypeReference<Foo<User>>()`有一对大括号`{}`。也就是说这里创建了一个继承了`TypeReference`的匿名类的对象，在编译完成后的项目`target`目录下，可以找到一个`TypeRefTest$1.class`字节码文件，因为匿名类的命名规则就是`主类名+$+(1,2,3……)`。

反编译这个文件可以看到这个继承了`TypeReference`的子类：

```java
static class TypeRefTest$1 extends TypeReference
{
    TypeRefTest$1()
    {
    }
}
```

我们知道，在创建子类的对象时，子类会默认先调用父类的无参构造方法，所以看一下`TypeReference`的构造方法：

```java
protected TypeReference(){
    Type superClass = getClass().getGenericSuperclass();
    Type type = ((ParameterizedType) superClass).getActualTypeArguments()[0];

    Type cachedType = classTypeCache.get(type);
    if (cachedType == null) {
        classTypeCache.putIfAbsent(type, type);
        cachedType = classTypeCache.get(type);
    }
    this.type = cachedType;
}
```

其实重点也就是前两行代码，先看第一行：

```java
Type superClass = getClass().getGenericSuperclass();
```

虽然这里是在父类中执行的代码，但是`getClass()`得到的一定是子类的Class对象，因为`getClass`()方法获取到的是当前运行的实例自身的Class，不会因为调用位置改变，所以`getClass()`得到的一定是`TypeRefTest$1`。

获取当前对象的Class后，再执行了`getGenericSuperclass()`方法，这个方法与`getSuperclass`类似，都会返回直接继承的父类。不同的是`getSuperclas`没有返回泛型参数，而`getGenericSuperclass`则返回了包含了泛型参数的父类。

再看第二行代码：

```java
Type type = ((ParameterizedType) superClass).getActualTypeArguments()[0];
```

首先将上一步获得的`Type`强制类型转换为`ParameterizedType`参数化类型，它是泛型的一个接口，实例则是继承了它的`ParameterizedTypeImpl`类的对象。

在`ParameterizedType`中定义了三个方法，上面代码中调用的`getActualTypeArguments()`方法就用来返回泛型类型的数组，可能返回有多个泛型，这里的`[0]`就是取出了数组中的第一个元素。

## 验证

好了，明白了上面的代码的作用后，让我们通过debug来验证一下上面的过程，执行上面`TypeRefTest`的代码，查看断点中的数据：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/24732c1e6ff54cdd98046b2b0d24b4a4~tplv-k3u1fbpfcp-zoom-1.image)

这里发现一点问题，按照我们上面的分析，讲道理这里父类`TypeReference`的泛型应该是`Foo<User>`啊，为什么会出现一个`List<String>`？

别着急，让我们接着往下看，如果你在`TypeReference`的无参构造方法中加了断点，就会发现代码执行中会再调用一次这个构造方法。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/7cdd395f39bf4b2a91de63c54b0cea0a~tplv-k3u1fbpfcp-zoom-1.image)

好了，这次的结果和我们的预期相同，父类的泛型数组中存储了`Foo<User>`，也就是说其实`TypeRefTest$1`继承的父类，完成的来说应该是`TypeReference<Foo<User>>`，但是我们上面反编译的文件中因为擦除的原因没有显示。

那么还有一个问题，为什么这个构造方法会被调用了两次呢？

看完了`TypeReference`的代码，终于在代码的最后一行让我发现了原因，原来是在这里先创建了一个`TypeReference`匿名类对象！

```java
public final static Type LIST_STRING 
    = new TypeReference<List<String>>() {}.getType();
```

因此整段代码执行的顺序是这样的：

- 先执行父类中静态成员变量的定义，在这里声明并实例化了这个`LIST_STRING`，所以会执行一次`TypeReference()`构造方法，这个过程对应上面的第一张图
- 然后在实例化子类的对象时，会再执行一次父类的构造方法`TypeReference()`，对应上面的第二张图
- 最后执行子类的空构造方法，什么都没有干

至于在这里声明的`LIST_STRING`，在其他地方也没有被再使用过，Hydra也不知道这行代码的意义是什么，有明白的小伙伴可以留言告诉我。

这里在拿到了`Foo`中的泛型`User`后，后面就可以按照这个类型来反序列化了，对后续流程有兴趣的小伙伴可以自己去啃啃源码，这里就不展开了。

## 扩展

了解了上面的过程后，我们最后通过一个例子加深一下理解，以常用的`HashMap`作为例子：

```java
public static void main(String[] args) {
    HashMap<String,Integer> map=new HashMap<String,Integer>();
    System.out.println(map.getClass().getSuperclass());
    System.out.println(map.getClass().getGenericSuperclass());
    Type[] types = ((ParameterizedType) map.getClass().getGenericSuperclass())
            .getActualTypeArguments();
    for (Type t : types) {
        System.out.println(t);
    }
}
```

执行结果如下，可以看到这里取到的父类是`HashMap`的父类`AbstractMap`，并且取不到实际的泛型类型。

```properties
class java.util.AbstractMap
java.util.AbstractMap<K, V>
K
V
```

修改上面的代码，仅做一点小改动：

```java
public static void main(String[] args) {
    HashMap<String,Integer> map=new HashMap<String,Integer>(){};
    System.out.println(map.getClass().getSuperclass());
    System.out.println(map.getClass().getGenericSuperclass());
    Type[] types = ((ParameterizedType) map.getClass().getGenericSuperclass())
            .getActualTypeArguments();
    for (Type t : types) {
        System.out.println(t);
    }
}
```

执行结果大有不同，可以看到，只是在`new HashMap<String,Integer>()`的后面加了一对大括号`{}`，就可以取到泛型的类型了：

```properties
class java.util.HashMap
java.util.HashMap<java.lang.String, java.lang.Integer>
class java.lang.String
class java.lang.Integer
```

因为这里实例化的是一个继承了`HashMap`的匿名内部类的对象，因此取到的父类就是`HashMap`，并可以获取到父类的泛型类型。

其实也可以再换一个写法，把这个匿名内部类换成显示声明的非匿名的内部类，再修改一下上面的代码：

```java
public class MapTest3 {
    static class MyMap extends HashMap<String,Integer>{}

    public static void main(String[] args) {
        MyMap myMap=new MyMap();
        System.out.println(myMap.getClass().getSuperclass());
        System.out.println(myMap.getClass().getGenericSuperclass());
        Type[] types = ((ParameterizedType) myMap.getClass().getGenericSuperclass())
                .getActualTypeArguments();
        for (Type t : types) {
            System.out.println(t);
        }
    }
}
```

运行结果与上面完全相同：

```properties
class java.util.HashMap
java.util.HashMap<java.lang.String, java.lang.Integer>
class java.lang.String
class java.lang.Integer
```

唯一不同的是显式生成的内部类与匿名类命名规则不同，这里生成的字节码文件不是`MapTest3$1.class`，而是`MapTest3$MyMap.class`，在`$`符后面使用的是我们定义的类名。

好啦，那么这次的填坑之旅就到这里，我是Hydra，下期见。