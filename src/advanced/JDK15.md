---
title: JDK15 新特性体验
icon: page
order: 7
author: Hydra
date: 2020-09-20
tag:
  - JDK
star: true
---



<!-- more -->

去年的时候，JDK已经发布到了17版本，虽然说工作中用的一直都是JDK8，但是Hydra对于这种新鲜事物还是挺好奇的，出了新的版本也都会试用一把新功能爽一下。虽然说出到了17，不过看看以前的笔记，连15都没有用过，趁着过年这几天有空，先来用了一下JDK15，把自己用的几个功能做了一下总结。

JDK15发布共包含了14个新特性，其中不乏一些功能的二次预览。下面，就来看一下4个能影响到我们编码习惯的功能吧。

JDK15可以配合IDEA 2020.2版本运行，测试前需要在Project Structure中修改`Project language level`开启对新特性的支持等级。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/733b2e0291c74701b69b864d888a305d~tplv-k3u1fbpfcp-zoom-1.image)

## 1、Sealed Classes

`Sealed Classes`表示一个封闭类，它能够防止其他类或接口扩展或实现它们。当一个类被`sealed`关键字修饰时，只能通过已知的子类型列表进行扩展，而不能通过其他任何扩展。

看一个简单的示例，允许2个子类对其进行扩展：

 ```java
public abstract sealed class Machine permits AirCondition, Television {
    protected final String name;
    public abstract void work();
    public Machine(String name) {
        this.name=name;
    }
}
 ```

在`permits` 后的列表中的类可以正常继承父类，并扩展自己的方法：

 ```java
public final class Television extends Machine {
    public Television(String name) {
        super(name);
    }
    @Override
    public void work() {
        System.out.println(name +" is working" );
    }
    public void play(){
        System.out.println("Television can play movie");
    }
}
 ```

但是当意图扩展一个不在`permits` 中的类时，编译时会告诉你无法继承：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1eda2deabe89432f8aa25f948c95a20d~tplv-k3u1fbpfcp-zoom-1.image)

## 2、Pattern Matching for instanceof 

模式匹配功能在jdk14中就已经被预览过一次，本次为第二次预览。简单的说，该功能就是普通`instanceof` 的增强版。

该功能允许我们在`instanceof` 后面的类型后再添加一个变量名，避免了再创建一次局部变量，进行一次赋值过程。同时，还能够减少我们在进行强制类型转换时手动造成的错误。

在`String`后面添加一个变量名，并直接可被引用：

```java
@Test
public void instanceTest(){
    Object o="pattern test";
    if (o instanceof String str){
        System.out.println(str);
    }
}
```

当然，也可以在后面加其他的判断条件。首先构建一个简单的实体类：

```java
@Getter
@AllArgsConstructor
public class Book {
    String name;
    double price;
}
```

在`instanceof` 后面加上一个判断条件：

 ```java
@Test
public void instanceTest3()
    Object object=new Book("Hydra monster",20.8);
    if (object instanceof Book book 
          && book.getName().equals("Hydra monster")){
        System.out.println(book.getPrice());
    }
}
 ```

## 3、Text Blocks

文本块功能已经在之前几版jdk中被预览过，在jdk15中转为正式功能。它允许我们自定义一个多行的字符串，可以避免使用大多数转义符号。并且可以让程序员按照自己的意愿控制文本块的输出格式。

文本块功能通过3个连续的双引号开启，同样以3个连续双引号关闭：

```java
@Test
public  void test () {
    String html = """
            <html>
                <body>
                    <p>text block, test</p>
                </body>
            </html>                
            """;
    System.out.println(html);
}
```

输出结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/27cc9e3f27cd4513bb09bdae2a03ca57~tplv-k3u1fbpfcp-zoom-1.image)

怎么样，是不是减少了平常代码时很多的 `\r` 和 `\n` ，以及字符串的拼接操作。

另外，通过添加 `\` 符号还可以控制禁止换行：

 ```java
@Test
public void test2(){
    String sql = """
            select * from user_info \
            where  \
            user_name = 'Hydra'\
            """;
    System.out.println(sql);
}
 ```

输出结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1b5b758e8f3747209d29ec44a997fe59~tplv-k3u1fbpfcp-zoom-1.image)

## 4、Records

`Records` 是一种新的类的声明形式，是一种受限制的类。经常听到一些同学抱怨，说java中有太多繁冗的`get`、`set`方法，在这种条件下`lombok`应景而生，而在jdk15中出现的`Record`可以说也具有类似的功能，在一些特定的场景下可以取代`lombok`。

定义一个`record` 的类：

```java
public record Person(String name , String age) {
}
```

初始化类并调用内置方法：

```java
@Test
public  void test()
    Person person=new Person("Hydra","18");
    System.out.println(person);
    System.out.println(person.age());
    System.out.println(person.name());
}
```

运行结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/76be7fda870f4a5f8e780a0bdf215435~tplv-k3u1fbpfcp-zoom-1.image)

那么代码中为什么可以直接调用构造函数等没有实现的方法呢，看一下编译后的class文件就明白了：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4294db77e4d44c498017adbbed64a022~tplv-k3u1fbpfcp-zoom-1.image)

在编译后生成的类自动继承了`Record`父类，并且自动生成了构造方法、`toString`，`hashCode`，`equals`，以及成员变量获取值的方法。之前已经看到`toString`方法的输出方式和`lombok`相同，再来验证一下`equals`方法。

```java
@Test
public void equalsTest()
    Person person=new Person("Hydra","18");
    Person person2=new Person("Trunks","20");
    Person person3=new Person("Hydra","18");
    System.out.println(person.equals(person2));
    System.out.println(person.equals(person3));
}
```

结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6c5e106b650942b482b4da4f611395b3~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，内置的`equals`方法很贴心的按照对象的属性值进行比较，而不是比较对象的内存地址。

总的来说，这次几个功能的更新都能够一定程度上简化程序员的工作繁杂度，但目前很多企业基本还停留在jdk8的版本上，大家可以先在非生产环境下熟悉一下jdk15，期待下一个LTS版本的发布。