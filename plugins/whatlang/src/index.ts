import { Computed, Context, Schema, Session, User, h, escapeRegExp, Universal } from 'koishi'
import * as what from './whatlang_interpreter'
import { help, help_list } from './helper'
import { } from '@koishijs/cache'


export const name = 'whatlang'
export interface Config {
    requireAppel: Computed<boolean>,
}
export const Config = Schema.object({
    requireAppel: (Schema
        .computed(Boolean).default(false)
        .description("在群聊中，使用倒问号快捷方式是否必须 @ bot 或开头带昵称。")
    ),
})
export const inject = ["database", "cache", "puppeteer"]


declare module 'koishi' {
    interface Tables {
        whatnoter: WhatNoter,
        whattimer: WhatTimer,
        whatcommands: WhatCommands,
    }
}
export interface WhatNoter {
    uid: number,
    public: string,
    protected: string,
    private: string,
}
export interface WhatTimer {
    name: string,
    time: number,
    code: string,
}
export interface WhatCommands {
    name: string,
    help: string,
    code: string,
}

declare module '@koishijs/cache' {
    interface Tables {
        [key: `whatlang_members_${string}`] : Universal.GuildMember,
    }
}


async function getMemberList(session: Session, gid: string) {
    let result : Universal.GuildMember[]
    try {
        const { data, next } = await session.bot.getGuildMemberList(session.guildId)
        result = data
        if (next) {
            const { data } = await session.bot.getGuildMemberList(session.guildId, next)
            result.push(...data)
        }
    } catch { }
    if (!result?.length) {
        for await (const value of session.app.cache.values(`whatlang_members_${gid}`)) {
            result.push(value)
        }
    }
    return result
}


const formatting : Function = (x: any) => typeof x == "string" ? x : what.formatting(x)
const msgtoarr : Function = (x: any) => [
    x.content, x.messageId ?? x.id,
    x.event.user.name ?? x.user?.name, x.userId, x.user?.id,
    x.channel?.id, x.quote?.id,
]
const htmlize : Function = (x : any, style : Record<string, any> = {
    padding: "5px",
    "max-width": "96ch",
    "font-family": "Consolas",
    "overflow-wrap": "break-word",
    "white-space": "break-spaces",
}) => h("html", {}, [h("div", {style: style}, [formatting(x)])])
const svglize : Function = (x : any) => h(
    "html", {}, h("svg", {xmlns: "http://www.w3.org/2000/svg", width: x[0], height: x[1]}, (x.slice(2).map((i : any) =>
        ["path", "p"].includes(i[0]) ? h("path", {style: i[1], d: i[2]}) :
        ["text", "t"].includes(i[0]) ? h("text", {style: i[1], x: i[2], y: i[3]}, [formatting(i[4])]) :
        ["img", "i"].includes(i[0]) ? h("image", {style: i[1], x: i[2], y: i[3], width: i[4], height: i[5], href: i[6]}) :
        ""
    ))
))
const run_what = async (code : string, session : Session) => {
    let output : (h | string)[] = []
    let stack : any = await what.eval_what(
        code, [[]], 
        Object.assign({
            help: (x : any) => help(x),
            helpall: (x : any) => void output.push(htmlize(help_list.reduce(
                (last : any, n : any, i : number) => last + n + ((i + 1) % 8 ? " ".repeat(10 - n.length) : "\n"), ""
            ))),
            pr: async () => session.prompt(),
            propt: async (x : any) => {
                return new Promise(res => {
                    const dispose = (session.app
                        .platform(session.platform)
                        .channel(session.channelId)
                        .middleware((session2, next) => {
                            if (session2.cid != session.cid) return next()
                            if (x &&
                                session2.userId != x &&
                                !(Array.isArray(x) && x.includes(session2.userId))
                            ) return next()
                            clearTimeout(timeout)
                            res(msgtoarr(session2))
                            dispose()
                        })
                    )
                    const timeout = setTimeout(() => {
                        dispose()
                        res(undefined)
                    }, session.app.config.delay.prompt)
                    return
                })
            },
            prompt: async (
                x : any, y : any,
                s : any[][],
                v : Record<string, any>,
                o : (x : any) => void,
            ) => {
                return new Promise(res => {
                    const dispose = (session.app
                        .platform(session.platform)
                        .middleware(async (session2, next) => {
                            if (session2.platform != session.platform) return next()
                            if (x &&
                                session2.channelId != x &&
                                !(Array.isArray(x) && x.includes(session2.channelId))
                            ) return next()
                            let temp : any[] = msgtoarr(session2)
                            let temp2 : any = await what.exec_what([...s.slice(0, -1), s.at(-1).concat([temp, y])], v, o)
                            if (!temp2 && !Number.isNaN(temp2)) return next()
                            clearTimeout(timeout)
                            res(temp)
                            dispose()
                        })
                    )
                    const timeout = setTimeout(() => {
                        dispose()
                        res(undefined)
                    }, session.app.config.delay.prompt)
                    return
                })
            },
            me: () => msgtoarr(session),
/*
            getuser: async (x : any) => {
                let user : any = await session.bot.getUser(x)
                return [
                    user.id, user.name, user.avatar,
                ]
            },
*/
            outimg: (x : any) => void output.push(h.image(x)),
            outaudio: (x : any) => void output.push(h.audio(x)),
            outvideo: (x : any) => void output.push(h.video(x)),
            outfile: (x : any) => void output.push(h.file(x)),
            outquote: (x : any) => void output.push(h.quote(x)),
            outat: (x : any) => void output.push(h.at(x)),
            outhtml: (x : any) => void output.push(htmlize(x)),
            outksq: (x : any) => void output.push(htmlize(x, {
                "line-height": "1",
                "font-family": "Kreative Square",
                "white-space": "break-spaces",
            })),
            outsvg: (x : any) => void output.push(svglize(x)),
            nout: () => void output.pop(),
            nouts: (x : any) => void output.splice(-x),
            nsend: async (x : any) => await session.bot.deleteMessage(session.channelId, x),
            send: async () => await session.send(output.pop()),
            sends: async (x : any) => await session.send(output.splice(-x)),
            sendsto: async (x : any, y : any) => await session.bot.sendMessage(x, output.splice(-y)),
/*
            panic: async () => {const d = session.app.before("send", () => {d(); return true})},
            panics: async (x : any) => {const d = session.app.before("send", () => {
                if (!x--) d()
                return true
            })},
*/
            cat: async (x : any) => {
                try {return await session.app.http.get(String(x), {responseType: "text"})}
                catch (err) {session.send(String(err)); return}
            },
            reesc: (x : any) => escapeRegExp(x),
            getmsg: async (
                x : any,
                s : any[][],
                v : Record<string, any>,
                o : (x : any) => void,
            ) => {
                for await (let i of session.bot.getMessageIter(session.channelId)) {
                    let temp : any[] = msgtoarr(i)
                    let temp2 : any = await what.exec_what([...s.slice(0, -1), s.at(-1).concat([temp, x])], v, o)
                    if (temp2 || Number.isNaN(temp2)) return temp
                }
            },
            msgbyid: async (x : any, y : any) => await msgtoarr(session.bot.getMessage(x || session.channelId, y)),
            sleep: async (x : any) => void await new Promise((res) => setTimeout(res, x * 1000)),
            notewc: async (x : any, y : any) => void await session.app.database.upsert("whatnoter", [{uid: x, public: y}], "uid"),
            notewd: async (x : any) => void await session.app.database.upsert("whatnoter", [{uid: (await session.observeUser(["id"])).id, protected: x}], "uid"),
            notewe: async (x : any) => void await session.app.database.upsert("whatnoter", [{uid: (await session.observeUser(["id"])).id, private: x}], "uid"),
            noterc: async (x : any) => (await session.app.database.get("whatnoter", {uid: x}, ["public"]))[0]?.public,
            noterd: async (x : any) => (await session.app.database.get("whatnoter", {uid: x}, ["protected"]))[0]?.protected,
            notere: async () => (await session.app.database.get("whatnoter", {uid: (await session.observeUser(["id"])).id}, ["private"]))[0]?.private,
            guildmem: async (x : any) => (await getMemberList(session, session.platform + ":" + x)).map(i => [i.user.name, i.user.id]),
            cmdset: async (x : any, y : any) => void await session.app.database.upsert("whatcommands", [{name: y, code: x}], "name"),
            cmdall: async (x : any, y : any) => (await session.app.database.get("whatcommands", {}, ["name"])).map(i => i.name),
            //cmdsethelp: async (x : any, y : any) => void await session.app.database.upsert("whatcommands", [{name: y, help: x}], "name"),
            cmddel: async (x : any) => void await session.app.database.remove("whatcommands", {name: x}),
            cmd: async (
                x : any, y : any,
                s : any[][],
                v : Record<string, any>,
                o : (x : any) => void,
            ) => {
                let temp : string = (await session.app.database.get("whatcommands", {name: y}, ["code"]))[0]?.code
                if (temp == undefined) return undefined
                return await what.exec_what([...s.slice(0, -1), s.at(-1).concat([x, temp])], v, o)
            },
        }, what.default_var_dict),
        (x : any) => void output.push(h.text(x)),
    )
    return output
}
what.need_svo.push(..."prompt getmsg cmd".split(" "))
const try_run_what = async (code : string, session : Session) => {
    try {return await run_what(code, session)}
    catch (e) {return h.escape(String(e))}
}


export function apply(ctx : Context, config: Config) {
    ctx.model.extend("whatnoter", {
        uid: "unsigned",
        public: "text",
        protected: "text",
        private: "text",
    }, {primary: "uid"})
    ctx.model.extend("whattimer", {
        name: "string",
        time: "unsigned",
        code: "text",
    }, {primary: "name"})
    ctx.model.extend("whatcommands", {
        name: "string",
        help: "text",
        code: "text",
    }, {primary: "name"})

    //yes I stole it from waifu shut up
    ctx.guild().on('message-created', async (session) => {
        if (!session.userId) return
        const member : Universal.GuildMember = session.event.member || { user: session.event.user }
        await ctx.cache.set(`whatlang_members_${session.gid}`, session.userId, member, 172800000)
    })
    ctx.on('guild-member-removed', (session) => {
        if (!session.userId) return
        ctx.cache.delete(`whatlang_members_${session.gid}`, session.userId)
    })

    ctx.command("whatlang <code:rawtext>", "运行 WhatLang 代码")
        .usage(h.escape(
            "可直接用 '¿<code...>' 代替\n" +
            "输入 '¿help@.' 获取帮助"
        ))
/*
        .example(h.escape("¿ `Hello, world! `"))
        .example(h.escape("¿ 10 range@ (2 + 2 pow@ 1 +.` `)#"))
        .example(h.escape("¿ 0x=_ 10n=_ 1.:{` `:x^+.\\x=_n^1-n=}"))
        .example(h.escape('¿ (http://spiderbuf.cn) link= (/s05)+ cat@ [((?<=<img.*?src=").*?(?=".*?>))g]match@ (link^ \+ outimg@send@)#'))
*/
        .action(({ session }, code) => try_run_what(code, session))
    ctx.command("whatcmd <name> <arg:rawtext>", "调用 What Commands 的指令")
        .usage(h.escape(
            "可直接用 '¿¿<name> <arg...>' 代替"
        ))
        .action(({ session }, name, arg) => try_run_what(`${name} ${arg} cmd@`, session))

    ctx.middleware(async (session, next) => {
        if (!session.isDirect && session.resolve(config.requireAppel) && !session.stripped.appel) return next()
        let content : string = h.select(session.stripped.content, "text").map(e => e.attrs.content).join("")
        if (content.startsWith("¿¿")) {
            let temp : string = content.slice(2)
            let temp0 : number = temp.indexOf(" ")
            let temp1 : string = '"' + (temp0 == -1 ? temp : temp.slice(1+ temp0)).replace(/(["\\])/g, "\\$1") + '"'
            let temp2 : string = '"' + (temp0 == -1 ? temp : temp.slice(0, temp0)).replace(/(["\\])/g, "\\$1") + '"'
            return await try_run_what(`${temp1} ${temp2} cmd@`, session)
        } else if (content.startsWith("¿")) return await try_run_what(content.slice(1), session)
        return next()
    })
}