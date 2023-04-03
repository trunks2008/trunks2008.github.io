---
title: 简单的Postman，还能玩出花？
icon: page
order: 4
author: Hydra
date: 2021-08-04
tag:
  - Postman
  - API
star: true
---



<!-- more -->

Postman是一款我们在工作中使用频率非常高的API调试工具，估计很多童鞋在使用它时也比较粗暴，填好接口地址、参数，直接send就完事了，估计大家要说了，这么简单的东西还能玩出什么花来。今天就和大家安利几个非常实用、但是可能一直被忽视的功能，用完之后，简直不要太香！

### 环境变量

我们通过一个例子来看一下环境变量的用法，在一个项目的生命周期中，可能会有开发环境、测试环境、预上线环境、线上环境等众多的不同环境，这时候就可以通过环境变量来管理接口的地址以及端口。

点击左侧的`Environments`，系统中默认已经存在了一个`Globals`的全局环境，在这里可以存放一些通用的公共变量的值。先在这里写入`host`和`port`信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e01d331e8ca44722a2db5dd68b19a10d~tplv-k3u1fbpfcp-zoom-1.image)

在需要使用变量时，可以在访问接口时使用双大括号包裹变量，以`{{variable}}`的方式进行引用：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1809f58a7a5e485e9de0c57cfeeaa7ac~tplv-k3u1fbpfcp-zoom-1.image)

除了默认的全局环境外，也可以自己创建新的环境来存放变量。在下面的例子中，创建了`local`和`test`两个环境，这样我们可以直接在两个环境间进行切换激活，简化了开发中测试接口的过程，不再需要频繁的改动接口的地址。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/58bfe9a10c23478681a362b171b4b882~tplv-k3u1fbpfcp-zoom-1.image)

如果激活的环境和全局环境中有名称重复的变量，那么当前激活的环境中的变量具有更高的优先级，它会直接覆盖`globals`环境中变量的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef21ed603d6a4459a7a2d061afd0adcc~tplv-k3u1fbpfcp-zoom-1.image)

在上面，我们将环境变量分为了两类，普通环境变量和全局变量。总的来说，全局变量具有更高的使用范围，即使切换到自己创建的环境，全局变量仍然可用。但是我们自己创建的环境之间是相互隔离的，如果切换到一个环境，那么其他环境中的变量将不再可用。

像上面这样手动写入变量的值，在某些时候可能不太方便满足一些需求，因此postman提供了一种方法，允许使用脚本来改变环境变量的值。我们来看一下发送请求中的`Pre-request Script`和`Tests`模块，它们是在请求发送前或完成后执行的脚本，具体的使用在后面具体介绍，现在我们只需要知道能在这里执行js代码就可以了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/49ed79d028224aafba23d15dfd3e8cd7~tplv-k3u1fbpfcp-zoom-1.image)

下面，在`Pre-request Script`中加入两行js代码：

```javascript
pm.globals.set("key1","value1");
pm.environment.set("key2","value2");
```

执行完成请求后再次查看环境变量，全局环境和当前环境中都写入了新的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3acfa458d981469eb83d8a523bd7aec7~tplv-k3u1fbpfcp-zoom-1.image)

同样，也可以使用脚本删除变量：

```javascript
pm.globals.unset("key1");
pm.environment.unset("key2");
```

除了上面的两类变量外，postman中的`Collection`也可以存储变量。`Collection`可以理解为一个集合，通常在使用中我们会将一个应用系统中的接口放在一个集合中，集合中的变量拥有更小的使用范围，仅在当前集合内可用：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bca4c253222440fbbca2e7b48458be45~tplv-k3u1fbpfcp-zoom-1.image)

同样，也可以在脚本中对它进行操作：

```javascript
pm.collectionVariables.set("key3","value3");
pm.collectionVariables.unset("key3");
```

在有了环境变量的基础后，再回头看一下上面提到的`Pre-request Script`和`Tests`，它们是两个比较类似的功能，用处也非常广泛。

### Pre-request Script

#### 运行js脚本

`Pre-request Script`可以翻译为预请求脚本，是在请求发送前被执行的代码逻辑，可以在这里执行一些`js`代码。通过下面的简单例子进行一下演示，先准备一个后台接口，将前端传递过来的时间戳转换为时间并打印：

```java
 @GetMapping("test1")
 public void time(@RequestParam("time") String time){
     Date date = new Date(Long.parseLong(time));
     System.out.println(date);
 }
```

在`Pre-request Script`中利用js代码获取当前时间，并放到集合变量中，在请求中传给后端：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fbf8e7692dd447c4947f2b8a31b14180~tplv-k3u1fbpfcp-zoom-1.image)

发送请求，控制台打印了前端接口的调用时间：

```properties
Tue Aug 01 14:14:29 CST 2021
```

#### 发送get请求

`Pre-request Script`的另一大用途就是，在请求当前接口前，通过执行脚本来先请求一下其他接口。在postman中，已经内置了`sendRequest`方法来发送`get`方法请求。我们在这里调用一个本地接口，并将信息打印到`console`控制台（可以通过 `Show Postman Console`开启）。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5a6a74451adc4ae9bb973de6977f3474~tplv-k3u1fbpfcp-zoom-1.image)

通过控制台的打印顺序，也可以看到，是在先执行了`Pre-request`中的请求后，才去执行的真正目标接口的请求。直接像上面这样调用`sendRequest`时，默认发送的`get`的请求，如果需要使用`post`请求、配置请求`header`或使用`json`传参的话，可以使用下面单独封装请求的方式。

#### 发送post请求

在这里，我们通过一个例子来演示`Pre-request Script`在具体的工作中能够怎样应用。有一个很普遍的场景，通常在调试需要权限认证的接口时，需要提前通过一个接口获取token，然后再访问目标接口时携带这个token。

这时就可以在`Pre-request Script`中先调用获取token的接口，再将token设置到集合的环境变量中，在之后的接口调用中引用它。在这里先准备了一个应用了`Shiro+JWT`的项目，其中通过登录接口获取token，之后的其他接口都需要带上这个token用于认证 。

我们在`sendRequest`发送`get`请求的基础上，进行一些修改。首先定义一个变量，在其中使用`url`指定请求地址，`method`指定请求方法，`body`携带参数，最后使用`sendRequest`进行请求的发送。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/075f04c4e5cf4670b0241573c302b1a0~tplv-k3u1fbpfcp-zoom-1.image)

在获取完成token后，通过下面的代码将获取的token放入了`Collection`的变量中：

```javascript
pm.collectionVariables.set("TOKEN",response.json().data.token);
```

查看`Collection`中的变量，已经保存了刚才获取的token：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/850a79006c324a76bcef8cee0c012ec7~tplv-k3u1fbpfcp-zoom-1.image)

在需要认证的接口`header`中，引用这个token，就可以正常的调用接口了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/45ea0c602e0d4bdeadb6368d0dfa3452~tplv-k3u1fbpfcp-zoom-1.image)

在上面的例子中，我们使用的是`urlencoded`的表单传参方式，如果接口定义是使用json方式传参，可以写成下面的格式：

```javascript
body: {
  mode: 'raw',
  raw: JSON.stringify({ key: 'value' })
}
```

如果需要传递`header`请求头信息，也可以在自定义的请求中添加：

```javascript
const loginRequest = {
  url: '...',
  header: [
      'Key1 : Value1',
      'Key2 : Value2'
  ],
  ...
};
```

具体的使用中需要添加什么字段非常的灵活，可以由我们自行进行配置。

### Tests

和`Pre-request Script`相对，`Tests`是在请求完成后执行的操作。这里我们回顾一下上面`Pre-request Script`中发送`post`请求的例子，其实可以通过`Tests`来进行改进。

因为在上面的例子中，获取到的token是`JWT`生成的，具有一定有效时间，在一段时间内是都可以复用的。因此我们可以先手动调用一次`login`接口获取token，完成后在`Tests`中使用脚本将获取的token放入`Collection`的变量中，就不需要在每次调用接口前都调用`login`接口重复获取token了。

调用`login`接口并存入缓存的过程：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abf99225505646cab8f883eebc72d383~tplv-k3u1fbpfcp-zoom-1.image)

之后在调用其他需要携带这个token的接口时，使用`{{TOKEN}}`的方式，就会自动填充刚才保存的`TOKEN`值。这样在获取到新的token后，每个接口中的token都会自动更新，就不需要再手动复制到每个接口了，极大的减少了工作量。

在postman中，在`Collection`中可以创建`Folder`文件夹，并且集合和文件夹上也可以添加`Pre-request Script`和`Tests`脚本。我们来看一下位于`Folder`中的请求，在执行`Pre-request Script`和`Tests`时顺序是怎样的，在每个环节中加入对应的打印语句，最后输出的结果是这样的：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d27c4beb45b44eb38323e091accf79cc~tplv-k3u1fbpfcp-zoom-1.image)

也就是说，在发送请求前，postman会先执行所有`Pre-request Script`，并且顺序是集合最先、文件夹次之、最后是请求中的，在执行完成真正的请求后执行所有的`Tests`，顺序同上。这也就要求我们在使用`Pre-request Script`及`Tests`功能前，首先要求我们对接口的调用顺序、数据的流向有一个明确的了解，这样才能保证不会出现空值或更新错误的情况。