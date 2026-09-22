'use strict';
const handler=require('./account');
module.exports=(req,res)=>{if(req.method!=='GET'){res.statusCode=405;return res.end();}req.query={health:'1'};return handler(req,res);};
