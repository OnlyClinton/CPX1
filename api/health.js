const { driveBackupConfig } = require("./_drive");
module.exports=(req,res)=>{
  const drive = driveBackupConfig();
  res.statusCode=200;
  res.setHeader("content-type","application/json");
  res.setHeader("cache-control","no-store");
  res.end(JSON.stringify({
    ok:true,
    service:"wdcc-dealer-portal",
    release:"V36.3.1",
    driveBackup:{configured:drive.configured,provider:drive.provider},
  }));
};
