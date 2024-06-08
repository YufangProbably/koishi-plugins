const op : Record<string, (x : any, y : any) => any> = {
    "+": (x, y) => (x + y),
    "-": (x, y) => (x - y),
    "*": (x, y) => (x * y),
    "/": (x, y) => (x / y),
    "%": (x, y) => (x % y),
    "?": (x, y) => x == y ? 0 : +(x > y) - +(x < y) || NaN,
}

const relize = (x : string) => Array.isArray(x) ? new RegExp(x[0], x[1]) : x

var default_var_dict : Record<string, any> = ({
    num: (x : any) => Number(x),
    str: (x : any) => (
      Array.isArray(x) && x.every(i => typeof i == "string" && i.length == 1)
      ? x.join("") : formatting(x)
    ),
    repr: (x : any) => repr_formatting(x),
    arr: (x : any) => [...x],
    pow: (x : any, y : any) => x ** y,
    band: (x : any, y : any) => x & y,
    bor: (x : any, y : any) => x | y,
    bxor: (x : any, y : any) => x ^ y,
    bnot: (x : any) => ~x,
    rand: () => Math.random(),
    randint: (x : any, y : any) => Math.floor((Math.random() * (x - y)) + y),
    flr: (x : any) => Math.floor(x),
    range: (x : any) => [...Array(x).keys()],
    len: (s : any[][]) => [...s.at(-1).at(-1)].length,
    split: (x : any, y : any) => (typeof x == "string" ? x : formatting(x)).split(y),
    join: (x : any, s : any[][]) => ([...s.at(-1).at(-1)]
        .map(i => typeof i == "string" ? i : formatting(i))
        .join(x)
    ),
    reverse: (s : any[][]) => [...s.at(-1).at(-1)].reverse(),
    in: (x : any, s : any[][]) => [...s.at(-1).at(-1)].indexOf(x),
    filter: async (
        x : any,
        s : any[][],
        v : Record<string, any>,
        o : (x : any) => void,
    ) => (await [...s.at(-1).at(-1)].reduce(async (memo : any, i : any) => (
        [...await memo, [i, await exec_what([...s.slice(0, -1), s.at(-1).concat([i, x])], v, o)]]
    ), [])).filter(i => i[1]).map(i => i[0]),
    chr: (x : any) => Array.isArray(x) ? String.fromCodePoint(...x) : String.fromCodePoint(x),
    ord: (x : any) => [...typeof x == "string" ? x : formatting(x)].map(i => i.codePointAt(0)),
    and: (x : any, y : any) => x && y,
    or: (x : any, y : any) => x || y,
    nan: () => NaN,
    undef: (s : any[][]) => void s.at(-1).push(undefined),
    inf: () => Infinity,
    ninf: () => -Infinity,
    eq: (x : any, y : any) => +(x === y),
    stak: (s : any[][]) => s.at(-1),
    stack: (s : any[][]) => [...s.at(-1)],
    try: async (
        s : any[][],
        v : Record<string, any>,
        o : (x : any) => void,
    ) => {
        let temp : string[] = [undefined, undefined]
        try {
            await exec_what(s, v, o)
        } catch (e) {
            temp = [e.name, e.message]
        }
        return temp
    },
    throw: (x : any) => {throw new Error(x)},
    match: (x : any, y : any) => [...x.match(relize(y)) || []],
    repl: (x : any, y : any, z : any) => x.replace(relize(y), z),
})
var need_svo : string[] = "filter try".split(" ")
var need_fstack : string[] = "len join reverse stak stack undef".split(" ")

const formatting : (x : any) => string = (x : any) => {
    if (Array.isArray(x)) {
        return "[" + x.map(
            i => Array.isArray(i) && i == x ? "[...]" : formatting(i)
        ).join(", ") + "]"
    } else if (typeof x == "string") {
        return '"' + (x
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
        ) + '"'
    } else if (x == undefined) {
        return "undef"
    } else if (Number.isNaN(x)) {
        return "NaN"
    } else if (x == Infinity) {
        return "Inf"
    } else if (x == -Infinity) {
        return "-Inf"
    }
    return String(x)
}

const is_valid_paren_string = (x : string) : boolean => {
    let depth = 0
    for (const c of x) {
        if (c === "(") depth++
        else if (c === ")") depth--
        if (depth < 0) return false
    }
    return depth === 0
}

const repr_formatting : (x : any) => string = (x : any) => {
    if (Array.isArray(x)) {
        return "[" + x.map(
            i => Array.isArray(i) && i == x ? "stack@" : repr_formatting(i)
        ).join(" ") + "]"
    } else if (typeof x == "string") {
        if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(x)) return x
        else if (is_valid_paren_string(x)) return "(" + x + ")"
        else return '"' + (x
            .replace('"', '\\"')
            .replace('\n', '\\n')
            .replace('\t', '\\t')
        ) + '"'
    } else if (x === undefined) {
        return "undef@"
    } else if (Number.isNaN(x)) {
        return "nan@"
    } else if (x == Infinity) {
        return "inf@"
    } else if (x == -Infinity) {
        return "ninf@"
    } else if (typeof x == "number") {
        if (
           x < 0 || x >= 1.0e+21 ||
           !Number.isInteger(x)
        ) return "(" + String(x) + ")num@"
        return String(x)
    }
    return "${" + String(x) + "}"
}

const exec_what = async (
    fstack : any[][], 
    var_dict : Record<string, any>,
    output : (x : any) => void,
) => {
    var stack : any[] = fstack.at(-1)
    let temp : any, temp2 : any, temp3 : any
    //I should stop temping
    temp = stack.pop()
    if (temp in var_dict && typeof var_dict[temp] === "function") {
        temp3 = (
            need_svo.includes(temp) ? 3 :
            need_fstack.includes(temp) ? 1 :
            0
        )
        temp = var_dict[temp]
        temp2 = [fstack, var_dict, output]
        temp2.splice(temp3)
        temp2 = (temp.length > temp3 ? stack.splice(temp3 - temp.length) : []).concat(temp2)
        temp = await temp(...temp2)
        if (temp != undefined) stack.push(temp)
    } else {
        temp2 = temp in var_dict ? var_dict[temp] : temp
        await eval_what(temp2, fstack, var_dict, output)
    }
    return stack.at(-1)
}
const run_what = async (
    code : string, 
    var_dict : Record<string, any> = default_var_dict
) => {
    let output : string = ""
    let stack : any = await eval_what(
        code, [[]], 
        Object.assign({}, var_dict),
        (x : any) => {output += x},
    )
    return ({
        stack: stack,
        output: output,
    })
}

const eval_what = async (
    code : string, fstack : any[][], 
    var_dict : Record<string, any>,
    output : (x : any) => void = (x : any) => console.log(x),
) => {
    var stack : any[] = fstack.at(-1)
    let i : number = -1, c : string
    let temp : any, temp2 : any
    while (++i < code.length) {
        c = code[i]
        if (/\s/.test(c)) {
            continue
        } else if (/\d/.test(c)) {
            temp = 0
            do {
                temp = temp * 10 + Number(c)
                c = code[++i]
            } while (c && /\d/.test(c))
            c = code[--i]
            stack.push(temp)
        } else if (/[a-zA-Z]/.test(c)) {
            temp = ""
            do {
                temp += c
                c = code[++i]
            } while (c && /[a-zA-Z0-9_]/.test(c))
            c = code[--i]
            stack.push(temp.toLowerCase())
        } else if ("'" === c) {
            stack.push(c = code[++i])
        } else if (/["`]/.test(c)) {
            temp = ""
            temp2 = c
            c = code[++i]
            while (c) {
                if ("\\" === c) {
                    c = code[++i]
                    temp += ({
                        "n": "\n",
                        "t": "\t",
                        [temp2]: temp2
                    })[c] ?? c
                } else if (temp2 === c) break
                else temp += c
                c = code[++i]
            }
            if ('"' === temp2) {
                stack.push(temp)
            } else if ('`' === temp2) {
                output(temp)
            }
        } else if (c in op) {
            temp = stack.pop()
            stack.push(op[c](stack.pop(), temp))
        } else if ('~' === c) {
            temp = stack.pop()
            stack.push(Number.isNaN(temp) ? 0 : +!temp)
        } else if ('[' === c) {
            stack = []
            fstack.push(stack)
        } else if ('|' === c) {
            temp = stack.pop()
            fstack.push(temp)
            stack = temp
        } else if (']' === c) {
            if (fstack.length <= 2) fstack.unshift([])
            stack = fstack.at(-2)
            stack.push(fstack.pop())
        } else if ('(' === c) {
            temp = ""
            temp2 = 1
            c = code[++i]
            while (true) {
                if ('(' === c) ++temp2
                else if (')' === c) --temp2
                if (!c || !temp2) break
                temp += c
                c = code[++i]
            }
            stack.push(temp)
        } else if ('.' === c) {
            temp = stack.at(-1)
            output(typeof temp == "string" ? temp : formatting(temp))
        } else if ('\\' === c) {
            if (stack.length >= 2) {
                temp = stack.pop()
                temp2 = stack.pop()
                stack.push(temp, temp2)
            }
        } else if (':' === c) {
            if (stack.length >= 1) {
                temp = stack.pop()
                stack.push(temp, temp)
            }
        } else if ('_' === c) {
            stack.pop()
        } else if ('=' === c) {
            temp = stack.pop()
            var_dict[temp] = stack.at(-1)
        } else if ('^' === c) {
            temp = stack.pop()
            temp2 = var_dict[temp]
            stack.push(typeof temp2 == "function" ? temp + "@" : temp2)
        } else if ('@' === c) {
            await exec_what(fstack, var_dict, output)
            stack = fstack.at(-1)
        } else if ('>' === c) {
            stack.push(stack.splice(-stack.pop()))
        } else if ('<' === c) {
            stack.push(...stack.pop())
        } else if ('{' === c) {
            temp = stack.pop()
            if (!(Number.isNaN(temp) || temp)) {
                temp = 1
                while (c && temp) {
                    c = code[++i]
                    if ('{' === c) ++temp
                    else if ('}' === c) --temp
                }
            }
        } else if ('}' === c) {
            temp = stack.pop()
            if (Number.isNaN(temp) || temp) {
                temp = -1
                while (c && temp) {
                    c = code[--i]
                    if ('{' === c) ++temp
                    else if ('}' === c) --temp
                }
            }
        } else if ('!' === c) {
            temp = 1
            while ('!' === code[++i]) temp++
            c = code[--i]
            while (c && temp) {
                c = code[++i]
                if ('{' === c) ++temp
                else if ('}' === c) --temp
            }
        } else if ("#" === c) {
            temp = stack.pop()
            stack.push(await stack.at(-1).reduce(async (memo : any, x : any) => (
                [...await memo, await exec_what([stack.concat([x, temp])], var_dict, output)]
            ), []))
        } else if ("," === c) {
            temp = stack.pop()
            stack.push(stack.at(-1).slice(temp, temp + 1)[0])
        } else if (";" === c) {
            temp = stack.pop()
            temp2 = stack.pop()
            if ([undefined, -1, stack.at(-1).length].includes(temp2) || Number.isNaN(temp2)) {
                stack.at(-1).push(temp)
            } else {
                stack.at(-1).fill(temp, temp2, temp2 + 1)
            }
        } else if ("$" === c) {
            temp = stack.pop()
            stack.at(-1).splice(temp, 1)
        }
        //console.log(stack)
        temp = void 0, temp2 = void 0
    }
    return stack.at(-1)
}

export {formatting, exec_what, eval_what, run_what, default_var_dict, need_svo, need_fstack}