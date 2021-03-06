const db = require('./mysql')
const {str_rand, escapeHtml, sfor} = require('../include/lib-perso')
const logModel = require('./login_models')
const until = require('../include/until')
const showdown = require('showdown')
const convert = new showdown.Converter()
const wait = require('wait.for')

const search = (q, data) => {
    return new Promise((resolve, reject) => {
        db.query(q, data, (err, res) => {
            err ? reject(err) : resolve(res)
        })
    })
}

const strRandVerif = taille => {
    const str = str_rand(taille)
    db.query('SELECT * FROM thread WHERE str_id = ?', [str] , (err, res, fields) => {
        if (err) throw err
        return res.length !== 0 ? strRandVerif(taille) : true
    })
    return str
}

const addReport = (thread_id, user_id, reason) => {
    db.query('INSERT INTO report SET ?', {
       reason : escapeHtml(reason),
       user_id : user_id,
       thread_id : escapeHtml(thread_id)
    }, (err, res, fields) => { if (err) throw err })
}

const addThread = (title, content, user) => {
    const str_id = strRandVerif(10)
    db.query('INSERT INTO thread SET ?', {
        str_id : str_id,
        title : escapeHtml(title),
        content : escapeHtml(content),
        user : user
    }, (err, res, fields) => { if (err) throw err })
    return str_id
}

const repThread = (id, content, user) => {
    db.query('INSERT INTO reponse SET ?', {
       content : escapeHtml(content),
       id_post : escapeHtml(id),
       id_user : user
    }, (err, res, fields) => { if (err) throw err })
}

const addEpingle = id => {
    isEpingle(id, isEp => {
        if (isEp === 0) {
            db.query('INSERT INTO epingle SET ?', {
                id_thread : id
            }, (err, res, fields) => { if (err) throw err })
        }
    })
}

const removeEpingle = id => {
    db.query('DELETE FROM epingle WHERE id_thread = ?', [id],
    (err, res, fields) => { if (err) throw err })
}

const searchThread = (id, res, err) => {
    search('SELECT * FROM thread WHERE str_id = ?', [id])
    .then(data => {
        const th = data[0]
        logModel.searchUserInfo(th.user, info => {
            res({
                str_id : th.str_id,
                title : th.title,
                content : convert.makeHtml(th.content),
                user : (th.user !== 0 && info.rank !== 0) 
                    ? info.username + ' • ' + until.showRank(info.rank) 
                    : info.username,
                username : info.username,
                userId : th.user,
                date : until.reformuleDate(th.date)
            })
        })
    })
    .catch(err2 => err(err2))
}

const updateThread = (id, data) => {
    const {title, content} = data
    db.query('UPDATE thread SET title = ?, content = ? WHERE str_id = ?', [
        title, 
        content, 
        id
    ],
    (err, res, fields) => { if (err) throw err })
}

const isEpingle = (id, res) => {
    search('SELECT COUNT(*) as nb FROM epingle WHERE id_thread = ?', [id])
    .then(data => {
        const [{nb}] = data
        res(nb === 1 ? 1 : 0)
    })
}

const searchRep = (id, res) => {
    search('SELECT * FROM reponse WHERE id_post = ? ORDER BY id', [id])
    .then(data => {
        wait.launchFiber(searchUserInfoRepSync, data, res)
    })
    .catch(err => {throw err})
}

const threadAcc = (limit, res, offset = 0) => {
    search('SELECT * FROM thread ORDER BY id DESC LIMIT ?, ?', [offset, limit])
    // search('SELECT * FROM thread ORDER BY id DESC', [limit])
    .then(data => {
        wait.launchFiber(searchUserInfoThreadSync, data, dataEp => {
            wait.launchFiber(isEpingleSync, dataEp, res)
        })
    })
    .catch(err => {throw err})
}

const searchEpingle = callRes => {
    db.query('SELECT * FROM epingle', (err, res, fields) => {
        if (err) throw err

        wait.launchFiber(searchThreadInfoEpingleSync, res, dataTh => {
            wait.launchFiber(searchUserInfoThreadSync, dataTh, callRes)
        })
    })
}

const searchUserInfoRepSync = (data, res) => {
    const rep = data.map(elem => {
        const [info] = wait.forMethod(db, 'query', 'SELECT * FROM user WHERE id = ?', [elem.id_user])
        return {
            content : elem.content,
            user : (elem.id_user !== 0 && info.rank !== 0) 
                ? info.username + ' • ' + until.showRank(info.rank) 
                : info.username,
            username : info.username,
            date : until.reformuleDate(elem.date)
        }
    })
    
    res(rep)
}

const searchUserInfoThreadSync = (data, res) => {
    const thread = data.map(elem => {
        const [info] = wait.forMethod(db, 'query', 'SELECT * FROM user WHERE id = ?', [elem.user])
        return {
            str_id : elem.str_id,
            title : elem.title,
            content : convert.makeHtml(elem.content),
            user : (elem.user !== 0 && info.rank !== 0) 
                ? info.username + ' • ' + until.showRank(info.rank) 
                : info.username,
            username : info.username,
            userId : elem.user,
            date : until.reformuleDate(elem.date)
        }
    })

    res(thread)
}

const isEpingleSync = (data, res) => {
    const th = data.map(elem => {
        const [{nb}] = wait.forMethod(db, 'query', 'SELECT COUNT(*) as nb FROM epingle WHERE id_thread = ?', [elem.str_id])
        return {
            str_id : elem.str_id,
            title : elem.title,
            content : elem.content,
            user : elem.user,
            username : elem.username,
            userId : elem.userId,
            date : elem.date,
            isEpingle : nb === 1 ? 1 : 0
        }
    })

    res(th)
}

const searchThreadInfoEpingleSync = (data, res) => {
    const epingle = data.map(elem => {
        const [info] = wait.forMethod(db, 'query', 'SELECT * FROM thread WHERE str_id = ?', [elem.id_thread])
        return {
            str_id : info.str_id,
            title : info.title,
            content : '',
            user : info.user,
            date : info.date
        }
    })

    res(epingle)
}



module.exports = {
    search,
    addThread,
    searchThread,
    strRandVerif,
    query : db.query,
    threadAcc,
    repThread,
    searchRep,
    searchEpingle,
    addEpingle,
    removeEpingle,
    isEpingle,
    updateThread,
    addReport
}