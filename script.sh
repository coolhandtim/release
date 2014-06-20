function test_error
{
	echo "testing for error"
	if [$? != "0"]; then
		echo "error found, exiting"
		exit 1
	fi
}

echo "getting closure compiler"
	mkdir -p vendor/java
	curl http://dl.google.com/closure-compiler/compiler-latest.zip && unzip compiler-latest.zip -d vendor/java/compiler
	export CLOSURE_JAR=vendor/java/compiler/compiler.jar

	echo "running closure compiler on dlc"
	java -jar $CLOSURE_JAR --js dlc.js --js_output_file dlc.min.js --language_in=ECMASCRIPT5
	test_error

	echo "running closure compiler on steamgifts-plus"
	java -jar $CLOSURE_JAR --js steamgifts-plus.js --js_output_file steamgifts-plus.min.js --language_in=ECMASCRIPT5
	test_error

	echo "pushing to git"
	set -x
	git status
	git add dlc.min.js
	git add steamgifts-plus.min.js
	git commit -m "Auto-generated minified js [ci skip]"
	git push origin master
	git push origin :gh-pages
	set +x
fi