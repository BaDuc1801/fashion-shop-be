import userModel from "../../model/user.model.js";

export const updateUserCartAfterOrder = async (order) => {
    const user = await userModel.findById(order.userId);
  
    if (!user || !user.cart?.length) return;
  
    const updatedCart = user.cart
      .map((cartItem) => {
        const matchedOrderItem = order.items.find(
          (item) =>
            item.productId.toString() === cartItem.product.toString() &&
            item.size === cartItem.size &&
            item.color === cartItem.color
        );
  
        if (!matchedOrderItem) return cartItem;
  
        const remainingQty =
          cartItem.quantity - matchedOrderItem.quantity;
  
        if (remainingQty > 0) {
          return {
            ...cartItem.toObject(),
            quantity: remainingQty,
          };
        }
  
        return null;
      })
      .filter(Boolean);
  
    user.cart = updatedCart;
    await user.save();
  };