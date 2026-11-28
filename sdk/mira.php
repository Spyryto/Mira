<?php
declare(strict_types=1);
// Standalone PHP CLI bootstrap; no Composer. Requires a trusted workspace.
$version = getenv('MIRA_VERSION') ?: '0.108';
if (!preg_match('/^\d+\.\d+(\.\d+)?$/D', $version)) { fwrite(STDERR,"Invalid version\n"); exit(1); }
$home = getenv('MIRA_HOME') ?: ((getenv('USERPROFILE') ?: getenv('HOME') ?: __DIR__) . '/.mira');
$root = $home . '/versions/' . $version;
function text(string $p): string { $v=file_get_contents($p); if($v===false)throw new RuntimeException("Cannot read $p"); return $v; }
function put(string $p,string $v): void { if(file_put_contents($p,$v)===false)throw new RuntimeException("Cannot write $p"); }
function mkdirs(string $p): void { if(!is_dir($p)&&!mkdir($p,0700,true))throw new RuntimeException("Cannot create $p"); }
function clean(string $p): void { if(!is_dir($p)||is_link($p))return; foreach(scandir($p) as $n){if($n==='.'||$n==='..')continue;$f="$p/$n";if(is_dir($f)&&!is_link($f))clean($f);else unlink($f);}rmdir($p); }
function tempdir(string $base): string { $p=$base.'/.mira-'.bin2hex(random_bytes(12));mkdirs($p);return $p; }
function safeName(string $p): bool { foreach(explode('/',$p) as $s)if(!preg_match('/^[A-Za-z0-9_. -]+$/D',$s)||preg_match('/^\.|[. ]$/D',$s)||preg_match('/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i',$s))return false;return true; }
function install(?string $local=null): void {
  global $root,$version;
  if(is_dir($root)){echo "Already installed: $root\n";return;}
  $url='https://github.com/Spyryto/Mira/releases/download/sdk-v'.$version.'/mira-sdk.json';
  $data=text($local??$url);$sum=trim(text(($local??$url).'.sha256'));
  if(!preg_match('/^[a-f0-9]{64}$/D',$sum)||!hash_equals($sum,hash('sha256',$data)))throw new RuntimeException('SDK checksum mismatch');
  $bundle=json_decode($data,true,512,JSON_THROW_ON_ERROR);
  if(($bundle['version']??null)!==$version||!is_array($bundle['files']??null))throw new RuntimeException('Wrong SDK version or bundle');
  mkdirs(dirname($root));$stage=tempdir(dirname($root));
  try{
    foreach($bundle['files'] as $name=>$content){
      if(!is_string($name)||!safeName($name)||!is_string($content))throw new RuntimeException('Invalid SDK entry');
      $dest="$stage/$name";mkdirs(dirname($dest));if(file_exists($dest))throw new RuntimeException('Duplicate SDK entry');put($dest,$content);
    }
    foreach(['compiler/mira.cjs','compiler/php/index.php','console-host.json','gui-host.json','ui-host.js'] as $name)if(!is_file("$stage/$name"))throw new RuntimeException('Incomplete SDK');
    if(!rename($stage,$root))throw new RuntimeException('Cannot finalize installation');
  }finally{clean($stage);}
  echo "Installed $root\n";
}
function launch(array $command,bool $capture=false): string {
  $proc=proc_open($command,[0=>STDIN,1=>$capture?['pipe','w']:STDOUT,2=>STDERR],$pipes,null,null,['bypass_shell'=>true]);
  if(!is_resource($proc))throw new RuntimeException('Cannot start process');
  $result=$capture?stream_get_contents($pipes[1]):'';if($capture)fclose($pipes[1]);
  if(proc_close($proc)!==0)throw new RuntimeException('Child process failed');return $result;
}
function compileSource(string $source,string $target,string $manifest): string {
  global $root;
  $file=realpath($source);if($file===false)throw new RuntimeException('Source missing');
  return launch([PHP_BINARY,"$root/compiler/php/index.php",$file,$target,'--host',"$root/$manifest"],true);
}
function build(string $source,string $target,?string $out=null): string {
  $code=compileSource($source,$target,'console-host.json');
  $output=$out??preg_replace('/\.mira$/i',$target==='js'?'.mjs':'.php',$source);
  if(realpath($output)!==false&&realpath($output)===realpath($source))throw new RuntimeException('Output would overwrite source');
  $prefix="const __miraHost = {log: value => console.log(value)};\n";
  $phpHost='$GLOBALS["__miraHost"] = ["log" => function ($value) { echo is_scalar($value) ? (string)$value : json_encode($value); echo PHP_EOL; }];';
  if($target==='php'&&!str_contains($code,'declare(strict_types=1);'))throw new RuntimeException('Unexpected PHP output');
  put($output,$target==='js'?$prefix.$code:str_replace('declare(strict_types=1);',"declare(strict_types=1);\n".$phpHost."\n",$code));return $output;
}
function web(string $source,string $dir): void {
  global $root;$code=compileSource($source,'js','gui-host.json');mkdirs($dir);
  $assets=['index.html'=>text("$root/gui.html"),'ui-host.js'=>text("$root/ui-host.js"),'app.js'=>text("$root/gui-entry.js")."\n".$code];
  foreach($assets as $n=>$v)if(file_exists("$dir/$n"))throw new RuntimeException("Output exists: $n");
  foreach($assets as $n=>$v)put("$dir/$n",$v);
}
try{
  if(PHP_SAPI!=='cli')throw new RuntimeException('CLI only');
  [, $cmd,$source,$option,$out]=array_pad($argv,5,null);
  if($cmd==='install'){install($source);exit;}
  if($cmd==='info'){echo "$version $root\n";exit;}
  if(!in_array($cmd,['build','run','web','serve'],true)||!is_string($source)||!str_ends_with($source,'.mira'))throw new RuntimeException('Usage: php mira.php install [bundle.json] | info | build/run FILE.mira [js|php] [output] | web FILE.mira DIRECTORY | serve FILE.mira [port]');
  install();
  if($cmd==='web'){if(!$option)throw new RuntimeException('Specify output directory');web($source,$option);echo "$option\n";exit;}
  if($cmd==='serve'){
    $port=filter_var($option??8765,FILTER_VALIDATE_INT,['options'=>['min_range'=>1024,'max_range'=>65535]]);if($port===false)throw new RuntimeException('Invalid port');
    $dir=tempdir(sys_get_temp_dir());try{web($source,$dir);echo "http://127.0.0.1:$port/\n";launch([PHP_BINARY,'-S',"127.0.0.1:$port",'-t',$dir]);}finally{clean($dir);}exit;
  }
  $target=$option??'php';if(!in_array($target,['js','php'],true))throw new RuntimeException('Expected js or php');
  if($cmd==='build'){echo build($source,$target,$out)."\n";exit;}
  $dir=tempdir(sys_get_temp_dir());try{$file=build($source,$target,$dir.($target==='js'?'/app.mjs':'/app.php'));launch([$target==='js'?'node':PHP_BINARY,$file]);}finally{clean($dir);}
}catch(Throwable $e){fwrite(STDERR,$e->getMessage()."\n");exit(1);}
