# Tripo 模型接入
1. 在 Tripo AI 导出 .glb（建议 低面数/Stylized，<5MB）
2. 按下列文件名放入本目录：opera.glb 戏楼 / siheyuan.glb 四合院 / gate.glb 宅门 / stall.glb 早点摊 / store.glb 小卖部
3. 在 manifest.json 中写入已放入的名字，例如 ["opera","stall"]
4. 刷新即自动替换对应的程序化建筑，并自动缩放、贴地、加墨线
