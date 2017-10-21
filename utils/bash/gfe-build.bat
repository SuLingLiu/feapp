@echo off

for %%i in (%*) do (
	cd /d %%i
	gfe output -uat -all
)