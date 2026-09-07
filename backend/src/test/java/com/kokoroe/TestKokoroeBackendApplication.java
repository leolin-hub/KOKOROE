package com.kokoroe;

import org.springframework.boot.SpringApplication;

public class TestKokoroeBackendApplication {

	public static void main(String[] args) {
		SpringApplication.from(KokoroeBackendApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
