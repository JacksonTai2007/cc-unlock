# Static Triage Playbook

适用：PE/EXE/DLL/SYS 初次静态分诊，确定文件类型、保护等级、入口链与后续分析路线。

## 分诊决策树

```
文件到达
 ├─ [前置] 安装/样本目录可见？
 │   ├─ 是 → 检查 Web 套壳指示文件（app.asar / libcef.dll / WebView2Loader.dll / *.pak）
 │   │   ├─ 命中 Electron → web-shell-triage.md → electron-playbook.md（IDA 不是主工具）
 │   │   ├─ 命中 CEF → web-shell-triage.md
 │   │   ├─ 命中 WebView2/Tauri/Wails → web-shell-triage.md
 │   │   └─ 未命中 → 继续
 │   └─ 否 → 继续
 ├─ 查PE签名(Digital Signature / Authenticode)
 │   ├─ 有效签名 → 白软件/可信来源 → 降低优先级
 │   └─ 无效/无签名 → 继续
 ├─ 查开发语言/框架
 │   ├─ .NET: Assembly-CSharp.dll / mscoree.dll导入 → dotnet.md
 │   ├─ Electron/CEF: asar包 / libcef.dll → web-shell-triage.md
 │   ├─ Delphi: TApplication / krnln.fnr → FLAIR签名恢复
 │   ├─ 易语言: fnr/fne扩展名 → 专用调用约定分析
 │   ├─ MFC/ATL: AFX_IDS / CWinApp → 消息映射识别
 │   ├─ Qt: Qt5Core.dll / MetaObject → 信号槽分析
 │   ├─ Python(PYD/Nuitka): Python C API模式 → 动态分析为主
 │   └─ 原生C/C++: 继续
 ├─ 查壳/保护
 │   ├─ 熵 > 7.2 → 加壳 → packers.md
 │   ├─ 区段名异常(.vmp/.UPX/.enigma1) → 已知壳 → packers.md
 │   ├─ EP不在.text → 有壳 → packers.md
 │   └─ 无明显壳 → 继续
 ├─ 查架构
 │   ├─ x86 → 注意WOW64边界
 │   ├─ x64 → 主流
 │   └─ ARM64 → 注意交叉编译
 ├─ 查类型
 │   ├─ EXE → 标准分析流
 │   ├─ DLL → DllMain + 导出函数优先
 │   ├─ SYS → driver.md
 │   └─ 其他 → 按文件头判断
 └─ 定入口链
     ├─ TLS callback → exception-runtime-playbook.md
     ├─ main/WinMain/DllMain → 标准分析
     └─ 壳入口 → packers.md
```

## PE 结构快速分析清单

```
[ ] IMAGE_DOS_HEADER: e_magic = "MZ" / e_lfanew指向NT头
[ ] IMAGE_NT_HEADERS:
    [ ] Signature = "PE\0\0"
    [ ] Machine: 0x14C(x86) / 0x8664(x64) / 0xAA64(ARM64)
    [ ] NumberOfSections
    [ ] TimeDateStamp(编译时间，可伪造)
    [ ] SizeOfImage vs SizeOfHeaders
    [ ] IMAGE_OPTIONAL_HEADER:
        [ ] AddressOfEntryPoint(RVA)
        [ ] ImageBase
        [ ] SectionAlignment / FileAlignment
        [ ] SizeOfStackReserve / SizeOfHeapReserve
        [ ] DllCharacteristics(NX/ASLR/CFG/TerminalServerAware)
        [ ] NumberOfRvaAndSizes
        [ ] DataDirectory[0]: Export Table
        [ ] DataDirectory[1]: Import Table
        [ ] DataDirectory[2]: Resource Table
        [ ] DataDirectory[5]: Base Relocation Table
        [ ] DataDirectory[9]: TLS Table
        [ ] DataDirectory[12]: Load Config (CFG/GS)
[ ] 节区扫描:
    [ ] .text — 代码段，应含有效指令
    [ ] .rdata — 只读数据，含导入表/IAT/字符串
    [ ] .data — 可读写数据
    [ ] .rsrc — 资源
    [ ] .reloc — 重定位
    [ ] 非标准节名 → 可疑，记录
    [ ] 每节 RawSize vs VirtualSize(差异大→可能有壳)
    [ ] 每节 Characteristic标志(可执行/可写)
[ ] 导入表:
    [ ] DLL列表及数量
    [ ] 关键API: CreateProcess/WriteProcessMemory/VirtualAlloc/LoadLibrary → 注入特征
    [ ] 关键API: CryptEncrypt/CBCryptEncrypt/RSA → 加密操作
    [ ] 关键API: WSAStartup/connect/send/recv → 网络通信
    [ ] 关键API: RegSetValueEx/CreateService → 持久化
    [ ] 只有GetProcAddress+LoadLibrary → 动态解析/IAT可能被破坏
[ ] 导出表:
    [ ] 导出函数名及数量(DLL/SYS重要)
    [ ] 序号导出 vs 名称导出
[ ] 资源:
    [ ] 嵌入PE/Shellcode(RT_RCDATA类型)
    [ ] 对话框/菜单(IDA无法直接关联时检查)
    [ ] 版本信息(CompanyName/FileDescription)
[ ] 数字签名:
    [ ] Authenticode签名状态
    [ ] 签名者/证书链
    [ ] 签名时间戳
[ ] TLS Directory:
    [ ] TLS回调函数地址 → 可能在main前执行
    [ ] 反调试/解密门常见位置
```

## 壳识别14条证据

```
[ ] 1.  区段名异常(.vmp/.UPX/.enigma1/.nsp/.MPRESS/.pespin)
[ ] 2.  EntryPoint不在.text
[ ] 3.  EntryPoint指向非标准指令(pushad/jmp far等)
[ ] 4.  RawSize远小于VirtualSize(压缩壳指标)
[ ] 5.  Import Table只有1-2个DLL
[ ] 6.  IAT只有GetProcAddress/LoadLibrary
[ ] 7.  节数量为1或异常(正常3-8个)
[ ] 8.  存在壳特征字符串("UPX"/"ASPack"/"VMProtect"/"Themida")
[ ] 9.  资源段异常大(壳常将原始PE存为资源)
[ ] 10. 重定位表被清除
[ ] 11. .text段属性异常(可写 = 代码自修改)
[ ] 12. 存在非标准节(.vmp0/.vmp1/.MPRESS1/.enigma2)
[ ] 13. 壳自身的stub代码(EP在壳节而非.text)
[ ] 14. PE头SizeOfImage与实际内存占用不符

评分: 命中0-2=可能无壳 / 3-5=轻度保护 / 6+=强壳 → packers.md
熵值参考: .text熵<6.0=正常 / 6.0-7.2=可能混淆 / >7.2=几乎确定加壳
```

## 常见壳快速识别表

```
壳名称        区段特征              EP特征                    熵值
UPX          .UPX0/.UPX1          pushad; jmp 解压代码       ~7.5
ASPack       .aspack/.adata       pushad; jmp [esp-4]       ~7.0
VMProtect    .vmp0/.vmp1          push imm32; call vm_entry  ~7.8+
Themida      .themida/.winlice    极少imports; TLS回调       ~7.8+
Enigma       EP_header/EP_Import  stub imports; XOR/ROL      ~7.5
MPRESS       .MPRESS1/.MPRESS2    pushad序列                 ~7.3
PESpin       无明显特征            SEH异常驱动               ~6.5
NSPack       .nsp0/.nsp1          PE头"pe"小写               ~7.0
ASProtect    .aspr                Code Splicing+SEH         ~7.2
Safengine    无标准区段名          Hash加密API名              ~7.5
ConfuserEx   (.NET)              .NET元数据混淆             ~6.5
```

## 编译器/语言指纹

```
Visual Studio:  rich header存在 / CRT启动代码(__security_init_cookie) / GS标志
GCC/MinGW:      .idata结构特征 / __mingw_CRTStartup / 缺少rich header
Clang:          类似GCC / 有.atheist节或LLVM特征
Delphi:         TApplication/TForm类 / krnln.fnr库 / UTF-16字符串密集
易语言:          fnr/fne扩展名 / 专用调用约定 / 窗口类名"ThunderRT6Form"
Go:             runtime.goexit / Go构建ID / pclntab结构 / 巨大二进制
Rust:           core::panicking / alloc::raw_vec / 编译器错误信息特征
Dlang:          _Dmain / druntime特征 / ModuleInfo结构
```

## 后续路由

```
无壳+原生C/C++ → IDA反编译 → 标准逆向流
有壳 → references/packers.md → 脱壳后回到本流程
.NET → references/dotnet.md → dnSpy/de4dot优先
SYS驱动 → references/driver.md → DriverEntry/IOCTL分析
Web套壳(Electron/CEF/Tauri) → references/web-shell-triage.md
游戏引擎 → references/game-reverse.md
疑似恶意软件 → references/malware-analysis.md
加壳混淆严重 → references/anti-obf.md
```

## 交付最少包含

- `run/static-triage-notes.md`
- `run/import-surface.md`
- `run/section-map.md` (节区布局)
- `run/protection-assessment.md` (保护等级评估)
