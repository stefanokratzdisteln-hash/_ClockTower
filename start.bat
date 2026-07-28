@echo off
cd /d "D:\Users\KRATZDISTELN\Desktop\STEFANO\_Programs\_ClockTower_Trouble-Brewing"

if errorlevel 1 (
	echo FAIL to open the dir
	pause
	exit /b 1
) 

call pnpm dev
pause

