---
title: 听老外吐槽框架设计，Why I Hate Frameworks?
icon: page
order: 4
author: Hydra
date: 2021-12-01
tag:
  - 架构
star: true
---



<!-- more -->

Hello，小伙伴们，今天不聊技术，分享点有意思的东西。前段时间，表弟给我发过来一篇老外写的文章，以略带讽刺的对话方式调侃了自己对框架的看法，我在读了一下以后也感觉比较有趣，这里分享给大家。

作者Benji Smith，可惜目前在这位老哥的个人网站上已经找不到这篇文章的原文了，只剩下了一段自我介绍。这里最后在国内的技术论坛里找到了英文原文和其他的大佬的翻译，这里我参考了一些版本的译文，配合自己的理解重新进行了一波翻译，并添加了一些插图，方便大家更容易地理解原文。

 好了，下面就来看一下正文吧。

## 正文

目前，我正处于构建一个Java web应用的计划阶段（是的，必须要使用Java，而其中各式各样的原因我现在并不想去讨论）。在这个过程中，我评估了一系列基于角色的CMS服务应用容器框架，并且它们基本使用了J2EE门户设计、遵循JSR规范的MVC架构。

> I'm currently in the planning stages of building a hosted Java web application (yes, it has to be Java, for a variety of reasons that I don't feel like going into right now). In the process, I'm evaluating a bunch of J2EE portlet-enabled JSR-compliant MVC role-based CMS web service application container frameworks.



但是在花了几十个小时阅读功能列表和文档后，我真想抠出我的眼珠子。

> And after spending dozens of hours reading through feature lists and documentation, I'm ready to gouge out my eyes.



让我们假设我决定做一个放香料的架子。

>Let's pretend I've decided to build a spice rack.

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6f3038098e7241dfa830f23f3d3a5fb2~tplv-k3u1fbpfcp-zoom-1.image)



在以前，我做过一些零碎的木匠活，因此我很清楚我到底需要什么：一些木头以及基础的工具，例如卷尺、锯子、水平仪和锤子。

> I've done small woodworking projects before, and I think I have a pretty good idea of what I need: some wood and a few basic tools: a tape measure, a saw, a level, and a hammer.

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9420006c8d58420b82053da5981cb4f7~tplv-k3u1fbpfcp-zoom-1.image)



如果我要建造一整栋房屋，而不仅是一个香料架的话，那么我需要的还是卷尺、锯子、水平仪、锤子以及其他的一些东西。

> If I were going to build a whole house, rather than just a spice rack, I'd still need a tape measure, a saw, a level, and a hammer (among other things).



所以我去了一家五金店，然后询问店员我在哪里能买到一把锤子。

> So I go to the hardware store to buy the tools, and I ask the sales clerk where I can find a hammer.

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bfd9a04475b844bcae93eb6e5a7bfdf1~tplv-k3u1fbpfcp-zoom-1.image)



“一把锤子？”他问道，“现在已经没有人再买锤子了，它们已经过时了。”

> "A hammer?" he asks. "Nobody really buys hammers anymore. They're kind of old fashioned."



我被这一发展趋势震惊了，并问他原因。

> Surprised at this development, I ask him why.



“嗯，锤子的问题就在于它有太多的种类了，就像大锤、羊角锤、球头锤等等。如果你买了一把后突然意识到你还需要另一种类的锤子怎么办呢，你还需要为你下一个任务再单独买一把。事实证明，大多数人需要一把能够解决生活中可能遇到的所有敲打任务的锤子。”

> "Well, the problem with hammers is that there are so many different kinds. Sledge hammers, claw hammers, ball-peen hammers. What if you bought one kind of hammer and then realized that you needed a different kind of hammer later? You'd have to buy a separate hammer for your next task. As it turns out, most people really want a single hammer that can handle all of the different kinds of hammering tasks you might encounter in your life."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4ec247bbdea0486abcb02ec373552d16~tplv-k3u1fbpfcp-zoom-1.image)



“呃，嗯，我认为这听起来确实不错。那么你能告诉我哪里能找到这么一把万能的锤子吗？”

> "Hmmmmmm. Well, I suppose that sounds all right. Can you show me where to find a Universal Hammer."



“不，我们已经不卖它了，它已经被淘汰了。”

> "No, we don't sell those anymore. They're pretty obsolete."



“是真的吗？但是你刚才还在说万能锤子是未来的潮流不是吗？”

> "Really? I thought you just said that the Universal Hammer was the wave of the future."



“事实证明，如果你仅仅制造出一种能够完成所有任务的锤子，它们反而不能很有效的处理其中的任何一件任务，就像用一把大锤去钉钉子就会很费力。并且，如果你想杀了你前任女友的话，真没有什么能够代替一把球头锤。”

> "As it turns out, if you make only one kind of hammer, capable of performing all the same tasks as all those different kinds of hammers, then it isn't very good at any of them. Driving a nail with a sledgehammer isn't very effective. And, if you want to kill your ex-girlfriend, there's really no substitute for a ball-peen hammer."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b02b365fe5b54162815cf21363cbd86c~tplv-k3u1fbpfcp-zoom-1.image)



“这倒是真的。那么，如果没有人买这种万能锤子的话，而你们也不再卖那些老款式的锤子的话，你们到底卖什么锤子呢？”

> "That's true. So, if nobody buys Universal Hammers anymore, and if you're no longer selling all those old-fashioned kinds of hammers, what kinds of hammers do you sell?"



“实际上，我们根本不卖锤子”

> "Actually, we don't sell hammers at all."



“那么……”

> "So..."



“根据我们的研究，人们真正需要的根本就不是万能锤子，最好还是能有一把合适类型的锤子来适用于不同的工作。因此，我们开始出售锤子工厂，它能够生产你可能感兴趣的各式各样的锤子。而你需要做的就是，为锤子工厂招聘工人、启动机器、购买原材料、支付水电费等等……很快你就能得到你所需要的那种特定的锤子。”

> "According to our research, what people really needed wasn't a Universal Hammer after all. It's always better to have the right kind of hammer for the job. So, we started selling hammer factories, capable of producing whatever kind of hammers you might be interested in using. All you need to do is staff the hammer factory with workers, activate the machinery, buy the raw materials, pay the utility bills, and PRESTO...you'll have *exactly* the kind of hammer you need in no time flat."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/17d554a50b324a018661eb3a1236a80e~tplv-k3u1fbpfcp-zoom-1.image)



“但是我真的不想买一个锤子工厂…”

> "But I don't really want to buy a hammer factory..."



“那就对了，因为我们早就不卖锤子工厂了。”

> "That's good. Because we don't sell them anymore."



“但我听见你刚才还在说……”

> "But I thought you just said..."



“我们发现，其实大多数人实际上并不需要一个完整的锤子工厂，例如有一些人可能永远用不到球头锤（或者是因为他们根本就没有前女友，或者他们可以用冰镐来代替锤子来杀死她们）。因此对人们来说，买一个能生产各种锤子的锤子工厂是没有意义的。”

> "We discovered that most people don't actually need an entire hammer factory. Some people, for example, will never need a ball-peen hammer. (Maybe they've never had ex-girlfriends. Or maybe they killed them with icepicks instead.) So there's no point in someone buying a hammer factory that can produce every kind of hammer under the sun."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/61cea0ac2167426e9392e34f7bdb5ed6~tplv-k3u1fbpfcp-zoom-1.image)



“嗯，这么听上去确实挺合理。”

> "Yeah, that makes a lot of sense."



“因此作为代替，我们开始出售锤子工厂的设计图，以便我们的客户能够搭建自己的锤子工厂，通过定制设计，只生产他们实际需要的那些种类的锤子。”

> "So, instead, we started selling schematic diagrams for hammer factories, enabling our clients to build their own hammer factories, custom engineered to manufacture only the kinds of hammers that they would actually need."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d95605d794664fabb3f6e48303581d7f~tplv-k3u1fbpfcp-zoom-1.image)



“让我猜一下，你们肯定也不再出售这些设计图了”

> "Let me guess. You don't sell those anymore."



“没错，当然不了。事实证明，人们不会仅仅为了制造几把锤子就去建造一整个工厂。把工厂的建造留给工厂建造专家，这才是我常常说到的。”

> "Nope. Sure don't. As it turns out, people don't want to build an entire factory just to manufacture a couple of hammers. Leave the factory-building up to the factory-building experts, that's what I always say!!"

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dade59773c404e9ea4f804963caf6e9e~tplv-k3u1fbpfcp-zoom-1.image)



“我很同意你的观点。”

> "And I would agree with you there."



“是的，所以我们停止出售那些设计图，转而去出售建造锤子工厂的工厂。每个建造锤子工厂的工厂都是由这一领域的顶级业务专家为你建造的，因此你不需要担心建造工厂的任何细节。你仍然可以享受自定义锤子工厂的所有优点，根据你自己特殊锤子的设计，生产你自己的定制锤子。”

> "Yup. So we stopped selling those schematics and started selling hammer-factory-building factories. Each hammer factory factory is built for you by the top experts in the hammer factory factory business, so you don't need to worry about all the details that go into building a factory. Yet you still get all the benefits of having your own customized hammer factory, churning out your own customized hammers, according to your own specific hammer designs."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8df2c3709cc14eedbf538fe3099dd768~tplv-k3u1fbpfcp-zoom-1.image)



“嗯，那实际上并不……”

> "Well, that doesn't really..."



“我知道你要说什么！！…我们早就不出售这些东西了。出于某些原因，并没有多少人去购买建造锤子工厂的工厂，因此我们想出了新的解决方案来处理这个问题。”

> "I know what you're going to say!! ...and we don't sell those anymore either. For some reason, not many people were buying the hammer factory factories, so we came up with a new solution to address the problem."



“呃，嗯。”

> "Uh huh."



“当我们回过头来，再审视这个统一工具的底层时，发现人们苦恼于管理这个建造锤子工厂的工厂、以及它生产出来的锤子工厂。如果你同时需要运营卷尺工厂的工厂、锯子工厂的工厂、水平仪工厂的工厂的话，那么开销会变的非常庞大，更不用说运营一家木材制造集团控股公司了。当我们真正考虑到这种情况的时候，我们认为这对于一个只想做一个香料架子的人来说，实在是过于复杂了。”

> "When we stepped back and looked at the global tool infrastructure, we determined that people were frustrated with having to manage and operate a hammer factory factory, as well as the hammer factory that it produced. That kind of overhead can get pretty cumbersome when you deal with the likely scenario of also operating a tape measure factory factory, a saw factory factory, and a level factory factory, not to mention a lumber manufacturing conglomerate holding company. When we really looked at the situation, we determined that that's just too complex for someone who really just wants to build a spice rack."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ded518b6279144148b935d3ed24704cb~tplv-k3u1fbpfcp-zoom-1.image)



“是的，这可不是闹着玩的。”

> "Yeah, no kidding."



“所以这个星期，我们正在推广一种通用型的工厂，用来建造生产工具工厂的工厂，这样一来，所有用来建造不同种类工具的工厂的工厂，就可以由一个单一和统一的工厂来建造了。这种通用工厂只生产你实际需要的工具工厂的建造工厂，而这些建造工厂将生成一个仅生产你自定义的工具的工厂。在这个过程中最后产生的工具，就是你特定工程需要的理想工具。最后只需要按下一个按钮，你就能够得到你需要的锤子和卷尺（尽管有可能你还需要部署一些配置文件，来使它按照你的期望工作）。”

> "So this week, we're introducing a general-purpose tool-building factory factory factory, so that all of your different tool factory factories can be produced by a single, unified factory. The factory factory factory will produce only the tool factory factories that you actually need, and each of those factory factories will produce a single factory based on your custom tool specifications. The final set of tools that emerge from this process will be the ideal tools for your particular project. You'll have *exactly* the hammer you need, and exactly the right tape measure for your task, all at the press of a button (though you may also have to deploy a few *configuration files* to make it all work according to your expectations)."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c96a543f563343a2ac79853e05f89846~tplv-k3u1fbpfcp-zoom-1.image)



“所以说你们根本就没有锤子，对吗？”

> "So you don't have any hammers? None at all?"



“是的，如果你真的需要一个高质量的、符合工业设计的香料架，你绝对需要这些更先进的东西，而不是一把能随便从破旧五金店买到的普通锤子。”

> "No. If you really want a high-quality, industrially engineered spice rack, you desperately need something more advanced than a simple hammer from a rinky-dink hardware store."

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/388c61073f854fe8b19d12011465081d~tplv-k3u1fbpfcp-zoom-1.image)



“现在每个人都是这样做的吗？当需要一把锤子的时候，他们都在使用一个通用的能够生产工具工厂的建造工厂的工厂吗？”

> "And this is the way everyone is doing it now? Everyone is using a general-purpose tool-building factory factory factory now, whenever they need a hammer?"



“是的。”

> "Yes."



“那么…好吧。我想这就是我必须要做的了。如果这就是处理事情的解决方案的话，我想我最好学学怎么使用它吧。”

> "Well…All right. I guess that's what I'll have to do. If this is the way things are done now, I guess I'd better learn how to do it."



“祝你好运！”

> "Good for you!!"



“这玩意儿一定是有文档的，对吧？”

> "This thing comes with documentation, right?"



现在，我已经自豪的拥有了自己的通用的工具工厂的建造工厂的建造工厂，我很欣慰地知道它与GPTBFFF 0.97 RC2草案相兼容，这一草案正是用来规范“通用的工具工厂的建造工厂的建造工厂”标准。

> Now that I'm the proud owner of my own general-purpose tool-building factory factory factory, I'm satisfied to know that it complies with the GPTBFFF 0.97 RC2 draft specification for tool-building factory factory factories.

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6cbdda2d559342eeadb35f6f5608a708~tplv-k3u1fbpfcp-zoom-1.image)



幸运的是，在面向工具的元工厂联盟中，70%的工人通过了这一版本规范的认证。

> Luckily, 70% of the workers in the Tool-Oriented Metafactory Union are certified against this version of the spec.



然而标准之争已初露端倪，一项名为UXCTBFFF（通用跨大陆工具制造FFF）的元工厂技术非常具有竞争力，它承诺将要统一通用工厂的建造工厂的建造工厂标准，来满足那些同时使用通用工厂方法和标准原始工具作为方案的的场景。

> On the horizon is a competing standard, though: a very compelling metafactory technolgy called the UXCTBFFF (Universal Trans-Continental Tool Building FFF), which promises to unify the factory factory factory industry to comply with guidelines of countries that use both metric and standard tools.



我的理解是，只要在用户界面上创建一个抽象层，肯定会有一个补丁包能使我的GPTBFFF 0.97 RC2与UXCTBFFF标准达到95%左右的兼容。

> My understanding is that there will be a service pack to my GPTBFFF 0.97 RC2 to bring it into nearly 95% compliance with the UXCTBFFF standard, just by creating an abstraction layer through its user interface.



太棒了！！

> Sweet!!



毫无疑问，这种新的发展一定能提高我的香料架子的质量（总有一天，当我搭建好我的通用工具工厂的建造工厂的建造工厂并使它开始运转、培训好我的劳动力、从柬埔寨进口好原材料后，我就要开始着手做我的香料架子了）。

> Surely this new development will improve the quality of my spicerack (which I'll get around to building one of these days, as soon as I've got my factory factory factory all up and running, my labor force trained, my raw materials imported from Cambodia, etc).

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5bc8f200b6cb4f7a834adca406e3d76e~tplv-k3u1fbpfcp-zoom-1.image)



**-- End --**

> Benji Smith个人网站：
>
> http://www.benjismith.net/
>
> 原文及译文参考：
>
> https://www.cnblogs.com/kkjmyazi/archive/2006/11/29/576573.html
>
> PS：
>
> 因为文中有很多我也不确定翻译是否正确的地方，所以贴出了英文原文。例如对于文中“which promises to unify the factory factory factory industry to comply with guidelines of countries that use both metric and standard tools.”这一句，如果从字面上进行翻译的话后半句大致意思是“使它符合一些同时使用公制和标准工具的国家的标准”，而我决定将它引申为“同时使用通用工厂方法和标准原始工具”。
>
> 诸如此类的地方，如果您有更好的建议，可以在公众号后台直接发送建议给我，万分感谢！
