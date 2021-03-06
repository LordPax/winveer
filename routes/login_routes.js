const app = require('express').Router()
const logModel = require('../models/login_models')
const {str_rand, escapeHtml} = require('../include/lib-perso')
const mw = require('../include/middleware')
const until = require('../include/until')

app.get('/register', mw.notLog, (req, res) => {
    const {err} = req.session
    const infoLog = req.session.infoLog ? req.session.infoLog : ''
    req.session.err = ''
    req.session.infoLog = ''

    res.render('pages/register', {titre: 'social-network - inscription', err, infoLog})
})

app.get('/login', mw.notLog, (req, res) => {
    const {err} = req.session
    req.session.err = ''

    res.render('pages/login', {titre: 'social-network - connexion', err})
})

app.post('/register', mw.notLog, (req, res) => {
    const {username, email, password, password2} = req.body
    until.registerVerif({
        username,
        email,
        password,
        password2
    }, data => {
        logModel.addUser({
            username : data.name,
            email : data.email,
            password : data.hash
        })
        res.redirect('/login')
    }, (err, data) => {
        req.session.err = err
        req.session.infoLog = {
            username : data.name,
            email : data.email
        }
        res.redirect('/register')
    })
})

app.post('/login', mw.notLog, (req, res) => {
    const {username, password} = req.body
    until.loginVerif({
        username,
        password
    }, id => {
        req.session.userId = id
        logModel.searchUserInfo(id, data => {
            req.session.pseudo = data.username
            req.session.rank = data.rank
            // res.redirect('/')
            res.redirect(req.session.currUrl ? req.session.currUrl : '/')
        })    
    }, err => {
        req.session.err = err
        res.redirect('/login')
    })
    
})

app.get('/logout', mw.log, (req, res) => {
    const url = req.session.currUrl
    req.session.destroy()
    // res.redirect('/login')
    res.redirect(url ? url : '/login')
})

module.exports = app