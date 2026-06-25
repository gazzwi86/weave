---
topic: api
stack: ts
references:
  - docs/stack-equivalents.md
---

# NestJS Controller — DTO class-validator, Swagger, Guards

NestJS 10, class-validator 0.14, @nestjs/swagger 7. `@UseGuards` keeps auth
out of the controller body. DTOs carry their own validation annotations.

```ts
// orders/orders.controller.ts
import {
  Controller, Get, Post, Param, Body, Query,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderResponseDto } from "./dto/order-response.dto";

@ApiTags("orders")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: "List orders for a customer" })
  @ApiResponse({ status: 200, type: [OrderResponseDto] })
  @Get()
  findAll(@Query("customerId", ParseUUIDPipe) customerId: string): Promise<OrderResponseDto[]> {
    return this.ordersService.findByCustomer(customerId);
  }

  @ApiOperation({ summary: "Create order" })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create(dto);
  }

  @ApiOperation({ summary: "Get order by id" })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  @ApiResponse({ status: 404, description: "Not found" })
  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    return this.ordersService.findOne(id);
  }
}
```

```ts
// orders/dto/create-order.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, IsArray, ValidateNested, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";

export class OrderItemDto {
  @ApiProperty() @IsUUID() skuId!: string;
  @ApiProperty({ minimum: 1 }) qty!: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsUUID() customerId!: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
```

```ts
// orders/dto/order-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class OrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty({ enum: ["pending", "confirmed", "shipped"] }) status!: string;
  @ApiProperty() total!: number;
}
```

```ts
// orders/orders.module.ts — wire it up
import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({ controllers: [OrdersController], providers: [OrdersService] })
export class OrdersModule {}
```

**Why:** `@UseGuards` at class level means new actions are automatically protected.
`@ValidateNested` + `@Type` handles nested object validation that plain `@IsObject`
misses. `ParseUUIDPipe` coerces and validates path params before the handler fires.
